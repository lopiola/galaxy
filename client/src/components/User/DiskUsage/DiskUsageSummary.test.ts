import { mount } from "@vue/test-utils";
import flushPromises from "flush-promises";
import { createPinia } from "pinia";
import { getLocalVue } from "tests/jest/helpers";

import { mockFetcher } from "@/schema/__mocks__";
import { getCurrentUser } from "@/stores/users/queries";
import { useUserStore } from "@/stores/userStore";

import { UserQuotaUsageData } from "./Quota/model";

import DiskUsageSummary from "./DiskUsageSummary.vue";

jest.mock("@/schema");
jest.mock("@/stores/users/queries");

const localVue = getLocalVue();

const quotaUsageClassSelector = ".quota-usage";
const basicDiskUsageSummaryId = "#basic-disk-usage-summary";

const fakeUserWithQuota = {
    id: "fakeUser",
    email: "fakeUserEmail",
    tags_used: [],
    isAnonymous: false,
    total_disk_usage: 1048576,
    quota_bytes: 104857600,
    quota_percent: 1,
    quota_source_label: "Default",
};

// TODO: Replace this with a mockFetcher when #16608 is merged
const mockGetCurrentUser = getCurrentUser as jest.Mock;
mockGetCurrentUser.mockImplementation(() => Promise.resolve(fakeUserWithQuota));

const fakeQuotaUsages: UserQuotaUsageData[] = [
    {
        quota_source_label: "Default",
        quota_bytes: 104857600,
        total_disk_usage: 1048576,
    },
];

const fakeTaskId = "fakeTaskId";

async function mountDiskUsageSummaryWrapper(enableQuotas: boolean) {
    mockFetcher
        .path("/api/configuration")
        .method("get")
        .mock({ data: { enable_quotas: enableQuotas } });
    mockFetcher.path("/api/users/{user_id}/usage").method("get").mock({ data: fakeQuotaUsages });
    mockFetcher
        .path("/api/users/current/recalculate_disk_usage")
        .method("put")
        .mock({ status: 200, data: { id: fakeTaskId } });
    mockFetcher.path("/api/tasks/{task_id}/state").method("get").mock({ data: "SUCCESS" });

    const pinia = createPinia();
    const wrapper = mount(DiskUsageSummary, {
        localVue,
        pinia,
    });
    const userStore = useUserStore();
    userStore.currentUser = fakeUserWithQuota;
    await flushPromises();
    return wrapper;
}

describe("DiskUsageSummary.vue", () => {
    it("should display basic disk usage summary if quotas are NOT enabled", async () => {
        const enableQuotasInConfig = false;
        const wrapper = await mountDiskUsageSummaryWrapper(enableQuotasInConfig);
        expect(wrapper.find(basicDiskUsageSummaryId).exists()).toBe(true);
        const quotaUsages = wrapper.findAll(quotaUsageClassSelector);
        expect(quotaUsages.length).toBe(0);
    });

    it("should display quota usage summary if quotas are enabled", async () => {
        const enableQuotasInConfig = true;
        const wrapper = await mountDiskUsageSummaryWrapper(enableQuotasInConfig);
        expect(wrapper.find(basicDiskUsageSummaryId).exists()).toBe(false);
        const quotaUsages = wrapper.findAll(quotaUsageClassSelector);
        expect(quotaUsages.length).toBe(1);
    });

    it("should display the correct quota usage", async () => {
        const enableQuotasInConfig = true;
        const wrapper = await mountDiskUsageSummaryWrapper(enableQuotasInConfig);
        const quotaUsage = wrapper.find(quotaUsageClassSelector);
        expect(quotaUsage.text()).toContain("1 MB");
    });

    it("should refresh the quota usage when the user clicks the refresh button", async () => {
        const enableQuotasInConfig = true;
        const wrapper = await mountDiskUsageSummaryWrapper(enableQuotasInConfig);
        const quotaUsage = wrapper.find(quotaUsageClassSelector);
        expect(quotaUsage.text()).toContain("1 MB");
        const updatedFakeQuotaUsages: UserQuotaUsageData[] = [
            {
                quota_source_label: "Default",
                quota_bytes: 104857600,
                total_disk_usage: 2097152,
            },
        ];
        mockFetcher.path("/api/users/{user_id}/usage").method("get").mock({ data: updatedFakeQuotaUsages });
        await wrapper.find("#refresh-disk-usage").trigger("click");
        await flushPromises();
        const refreshingAlert = wrapper.find(".refreshing-alert");
        expect(refreshingAlert.exists()).toBe(true);
        // Make sure the refresh has finished before checking the quota usage
        await flushPromises();
        await flushPromises();
        // The refreshing alert should disappear and the quota usage should be updated
        expect(refreshingAlert.exists()).toBe(false);
        expect(quotaUsage.text()).toContain("2 MB");
    });
});
