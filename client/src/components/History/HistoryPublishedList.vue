<script setup>
import { useInfiniteScroll } from "@vueuse/core";
import Heading from "components/Common/Heading";
import DebouncedInput from "components/DebouncedInput";
import LoadingSpan from "components/LoadingSpan";
import StatelessTags from "components/TagsMultiselect/StatelessTags";
import ScrollToTopButton from "components/ToolsList/ScrollToTopButton";
import UtcDate from "components/UtcDate";
import { useAnimationFrameScroll } from "composables/sensors/animationFrameScroll";
import Filtering, { contains, equals, expandNameTag } from "utils/filtering";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { getPublishedHistories, updateTags } from "./services";

const LIMIT = 50;

const validFilters = {
    name: contains("name"),
    annotation: contains("annotation"),
    tag: contains("tags", "tag", expandNameTag),
    user: contains("username"),
    user_eq: equals("username"),
};

const filters = new Filtering(validFilters, false);

const props = defineProps({
    fUsername: {
        type: String,
        required: false,
        default: null,
    },
});

const offset = ref({ "-update_time-true": 0 });
const allHistories = ref([]);
const results = ref([]);
const error = ref(null);
const loading = ref(false);
const sortDesc = ref(true);
const filterText = ref("");
const showAdvanced = ref(false);
const sortBy = ref("update_time");
const scrollableDiv = ref(null);
const { scrollTop } = useAnimationFrameScroll(scrollableDiv);
const loadedItemIds = ref(new Set());

const noItems = computed(() => !loading.value && allHistories.value.length === 0 && !filterText.value);
const noResults = computed(() => !loading.value && results.value.length === 0 && filterText.value);
const allLoaded = computed(() => {
    return noResults.value === false && offset.value[getOffsetKey(sortBy.value, sortDesc.value)] === null;
});

const fields = computed(() => [
    { key: "name", sortable: !loading.value },
    { key: "annotation", sortable: false },
    { label: "Owner", key: "username", sortable: false },
    { label: "Tags", key: "tags", sortable: false },
    { label: "Last Updated", key: "update_time", sortable: !loading.value },
]);

const localFilter = computed({
    get() {
        return filterText.value;
    },
    set(newVal) {
        if (newVal !== filterText.value) {
            updateFilter(newVal);
        }
    },
});

const filterSettings = computed(() => filters.toAlias(filters.getFiltersForText(filterText.value)));

const updateFilter = (newVal) => {
    filterText.value = newVal.trim();
};

const setFilter = (filter, tag) => {
    updateFilter(filters.setFilterValue(filterText.value, filter, tag));
};

const onTagsUpdate = (newTags, row) => {
    row.item.tags = newTags;
    updateTags(row.item.id, "History", row.item.tags);
};

const onToggle = () => {
    showAdvanced.value = !showAdvanced.value;
};

const onSearch = () => {
    onToggle();
    updateFilter(filters.getFilterText(filterSettings.value));
};

const scrollToTop = () => {
    scrollableDiv.value.scrollTo({ top: 0, behavior: "smooth" });
};

const sortAndFilterHistories = () => {
    allHistories.value = allHistories.value.sort((a, b) => {
        const aVal = String(a[sortBy.value]).trim();
        const bVal = String(b[sortBy.value]).trim();
        if (!sortDesc.value) {
            return aVal - bVal;
        } else {
            return bVal - aVal;
        }
    });

    if (filterText.value) {
        const currFilters = filters.getFiltersForText(filterText.value);
        results.value = allHistories.value.filter((history) => {
            if (!filters.testFilters(currFilters, history)) {
                return false;
            }
            return true;
        });
    } else {
        // no filter
        results.value = allHistories.value;
    }
};

function getOffsetKey(sort_by, sort_desc) {
    return `${filters.getQueryString(filterText.value)}-${sort_by}-${sort_desc}`;
}

async function load() {
    if (loading.value) {
        return;
    }
    loading.value = true;
    if (allLoaded.value) {
        sortAndFilterHistories();
        loading.value = false;
        error.value = null;
        return;
    }

    // Define offsetKey in offset ref if it doesn't exist
    const currOffsetKey = getOffsetKey(sortBy.value, sortDesc.value);
    let currentOffset = offset.value[currOffsetKey];
    if (currentOffset === undefined) {
        offset.value[currOffsetKey] = 0;
        currentOffset = 0;
    }

    await getPublishedHistories(
        {
            limit: LIMIT,
            offset: currentOffset,
            sortBy: sortBy.value,
            sortDesc: sortDesc.value,
            filterText: filterText.value,
        },
        filters
    )
        .then((data) => {
            // add all new incoming histories to allHistories
            const newData = data.filter((item) => !loadedItemIds.value.has(item.id));
            allHistories.value = [...allHistories.value, ...newData];
            newData.forEach((item) => loadedItemIds.value.add(item.id));

            // sort and filter allHistories containing new histories
            sortAndFilterHistories();

            // ------ UPDATE OFFSET ------
            if (results.value.length > currentOffset - 1 && data.length >= 50) {
                const addToOffset = filterText.value ? 1 : 0;
                offset.value[currOffsetKey] = results.value.length === 0 ? 0 : results.value.length + addToOffset;
            } else {
                // All items loaded for current filter/offsetKey
                offset.value[getOffsetKey("update_time", true)] = null;
                offset.value[getOffsetKey("update_time", false)] = null;
                offset.value[getOffsetKey("name", true)] = null;
                offset.value[getOffsetKey("name", false)] = null;
            }
            // ---------------------------
            error.value = null;
        })
        .catch((error) => {
            error.value = error;
        })
        .finally(() => {
            loading.value = false;
        });
}

onMounted(async () => {
    if (props.fUsername) {
        filterText.value = filters.getFilterText({ "user_eq:": props.fUsername });
    }
    await load();
    useInfiniteScroll(scrollableDiv.value, () => load());
});

onUnmounted(() => {
    // Remove the infinite scrolling behavior
    useInfiniteScroll(scrollableDiv.value, () => {});
});

watch([filterText, sortBy, sortDesc], async () => {
    await load();
});
</script>

<template>
    <section id="published-histories" class="d-flex flex-column position-relative overflow-hidden">
        <Heading h1>Published Histories</Heading>

        <b-alert v-if="noItems" variant="info" show>No published histories found.</b-alert>

        <div v-else>
            <b-input-group class="mb-2">
                <DebouncedInput v-slot="{ value, input }" v-model="localFilter">
                    <b-form-input
                        id="published-histories-filter"
                        size="sm"
                        :class="filterText && 'font-weight-bold'"
                        :value="value"
                        :placeholder="'Search by name or use the advanced filtering options' | localize"
                        title="clear search (esc)"
                        data-description="filter text input"
                        @input="input"
                        @keyup.esc="updateFilter('')" />
                </DebouncedInput>
                <b-input-group-append>
                    <b-button
                        id="published-histories-advanced-filter-toggle"
                        size="sm"
                        :pressed="showAdvanced"
                        :variant="showAdvanced ? 'info' : 'secondary'"
                        title="show advanced filter"
                        data-description="show advanced filter toggle"
                        aria-label="Show advanced filter"
                        @click="onToggle">
                        <icon v-if="showAdvanced" icon="angle-double-up" />
                        <icon v-else icon="angle-double-down" />
                    </b-button>
                    <b-button
                        size="sm"
                        aria-label="Clear filters"
                        data-description="clear filters"
                        @click="updateFilter('')">
                        <icon icon="times" />
                    </b-button>
                </b-input-group-append>
            </b-input-group>

            <div v-if="showAdvanced" class="mt-2" @keyup.esc="onToggle" @keyup.enter="onSearch">
                <small>Filter by name:</small>
                <b-form-input
                    id="published-histories-advanced-filter-name"
                    v-model="filterSettings['name:']"
                    size="sm"
                    placeholder="any name" />
                <small class="mt-1">Filter by annotation:</small>
                <b-form-input v-model="filterSettings['annotation:']" size="sm" placeholder="any annotation" />
                <small class="mt-1">Filter by community tag:</small>
                <b-form-input
                    id="published-histories-advanced-filter-tag"
                    v-model="filterSettings['tag:']"
                    size="sm"
                    placeholder="any community tag" />
                <small class="mt-1">Filter by owner:</small>
                <b-form-input
                    id="published-histories-advanced-filter-username"
                    v-model="filterSettings['user:']"
                    size="sm"
                    placeholder="any username" />
                <div class="mt-3">
                    <b-button
                        id="published-histories-advanced-filter-submit"
                        class="mr-1"
                        size="sm"
                        variant="primary"
                        description="apply filters"
                        @click="onSearch">
                        <icon icon="search" />
                        <span>{{ "Search" | localize }}</span>
                    </b-button>
                    <b-button size="sm" @click="onToggle">
                        <icon icon="redo" />
                        <span>{{ "Cancel" | localize }}</span>
                    </b-button>
                </div>
            </div>

            <b-alert v-if="noResults || error" :variant="error ? 'danger' : 'info'" show>
                <div>
                    No matching entries found for: <span class="font-weight-bold">{{ filterText }}</span>
                </div>
                <div v-if="error">
                    <i>{{ error }}</i>
                </div>
            </b-alert>

            <b-alert v-if="results.length === 0 && loading" variant="info" show>
                <LoadingSpan message="Loading published histories" />
            </b-alert>
        </div>

        <div ref="scrollableDiv" class="overflow-auto">
            <b-table
                v-if="results.length"
                id="published-histories-table"
                no-sort-reset
                striped
                :fields="fields"
                :items="results"
                :sort-by.sync="sortBy"
                :sort-desc.sync="sortDesc">
                <template v-slot:cell(name)="row">
                    <router-link :to="`/published/history?id=${row.item.id}`">
                        {{ row.item.name }}
                    </router-link>
                </template>
                <template v-slot:cell(username)="row">
                    <a
                        href="#"
                        class="published-histories-username-link"
                        @click="setFilter('user_eq', row.item.username)"
                        >{{ row.item.username }}</a
                    >
                </template>
                <template v-slot:cell(tags)="row">
                    <StatelessTags
                        clickable
                        :value="row.item.tags"
                        :disabled="true"
                        @input="(tags) => onTagsUpdate(tags, row)"
                        @tag-click="(tag) => setFilter('tag', tag)" />
                </template>

                <template v-slot:cell(update_time)="data">
                    <UtcDate v-if="data.value" :date="data.value" mode="elapsed" />
                    <span v-else> - </span>
                </template>
            </b-table>
            <div v-if="allLoaded" class="list-end my-2">- End of search results -</div>
            <b-overlay :show="loading" opacity="0.5" />
            <ScrollToTopButton :offset="scrollTop" @click="scrollToTop" />
        </div>
    </section>
</template>

<style lang="scss">
@import "theme/blue.scss";
.list-end {
    width: 100%;
    text-align: center;
    color: $text-light;
}
</style>
