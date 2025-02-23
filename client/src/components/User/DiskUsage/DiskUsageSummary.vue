<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";

import { useConfig } from "@/composables/config";
import { useTaskMonitor } from "@/composables/taskMonitor";
import { fetcher } from "@/schema";
import { useUserStore } from "@/stores/userStore";
import { errorMessageAsString } from "@/utils/simple-error";
import { bytesToString } from "@/utils/utils";

import { QuotaUsage, UserQuotaUsageData } from "./Quota/model";

import QuotaUsageSummary from "@/components/User/DiskUsage/Quota/QuotaUsageSummary.vue";

const { config, isConfigLoaded } = useConfig(true);
const userStore = useUserStore();
const { currentUser } = storeToRefs(userStore);
const { isRunning: isRecalculateTaskRunning, waitForTask } = useTaskMonitor();

const quotaUsages = ref<QuotaUsage[]>();
const errorMessage = ref<string>();
const isRecalculating = ref<boolean>(false);

const niceTotalDiskUsage = computed(() => {
    if (!currentUser.value || currentUser.value.isAnonymous) {
        return "Unknown";
    }
    return bytesToString(currentUser.value.total_disk_usage, true);
});

const isRefreshing = computed(() => {
    return isRecalculateTaskRunning.value || isRecalculating.value;
});

watch(
    () => isRefreshing.value,
    (newValue, oldValue) => {
        // Make sure we reload the user and the quota usages when the recalculation is done
        if (oldValue && !newValue) {
            const includeHistories = false;
            userStore.loadUser(includeHistories);
            loadQuotaUsages();
        }
    }
);

async function displayRecalculationForSeconds(seconds: number) {
    return new Promise<void>((resolve) => {
        isRecalculating.value = true;

        setTimeout(() => {
            isRecalculating.value = false;
            resolve();
        }, seconds * 1000);
    });
}

const recalculateDiskUsage = fetcher.path("/api/users/current/recalculate_disk_usage").method("put").create();

async function onRefresh() {
    try {
        const response = await recalculateDiskUsage({});
        if (response.status == 200) {
            // Wait for the task to complete
            waitForTask(response.data.id);
        } else if (response.status == 204) {
            // We cannot track any task, so just display the
            // recalculation message for a reasonable amount of time
            await displayRecalculationForSeconds(30);
        }
    } catch (e) {
        errorMessage.value = errorMessageAsString(e);
    }
}

const fetchQuotaUsages = fetcher.path("/api/users/{user_id}/usage").method("get").create();

async function loadQuotaUsages() {
    try {
        const { data } = await fetchQuotaUsages({ user_id: "current" });
        quotaUsages.value = data.map((u: UserQuotaUsageData) => new QuotaUsage(u));
    } catch (e) {
        errorMessage.value = errorMessageAsString(e);
    }
}

onMounted(async () => {
    await loadQuotaUsages();
});
</script>
<template>
    <div>
        <b-alert v-if="errorMessage" variant="danger" show>
            <h2 v-localize class="alert-heading h-sm">Failed to access disk usage details.</h2>
            {{ errorMessage }}
        </b-alert>
        <b-container v-if="currentUser">
            <b-row v-if="isConfigLoaded && config.enable_quotas" class="justify-content-md-center">
                <QuotaUsageSummary v-if="quotaUsages" :quota-usages="quotaUsages" />
            </b-row>
            <h2 v-else id="basic-disk-usage-summary" class="text-center my-3">
                You're using <b>{{ niceTotalDiskUsage }}</b> of disk space.
            </h2>
        </b-container>
        <b-container class="text-center mb-5 w-75">
            <button
                id="refresh-disk-usage"
                title="Recalculate disk usage"
                :disabled="isRefreshing"
                variant="outline-secondary"
                size="sm"
                pill
                @click="onRefresh">
                <b-spinner v-if="isRefreshing" small />
                <span v-else>Refresh</span>
            </button>
            <b-alert v-if="isRefreshing" class="refreshing-alert mt-2" variant="info" show dismissible fade>
                Recalculating disk usage... this may take some time, please check back later.
            </b-alert>
        </b-container>
    </div>
</template>
