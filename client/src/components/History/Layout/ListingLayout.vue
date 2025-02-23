<template>
    <div class="listing-layout">
        <VirtualList
            ref="listing"
            class="listing"
            role="list"
            data-key="id"
            :offset="offset"
            :data-sources="items"
            :data-component="{}"
            :estimate-size="estimatedItemHeight"
            :keeps="estimatedItemCount"
            @scroll="onScroll">
            <template v-slot:item="{ item }">
                <slot name="item" :item="item" :current-offset="getOffset()" />
            </template>
            <template v-slot:footer>
                <LoadingSpan v-if="loading" class="m-2" message="Loading" />
            </template>
        </VirtualList>
    </div>
</template>
<script>
import { useElementBounding } from "@vueuse/core";
import LoadingSpan from "components/LoadingSpan";
import { computed, ref } from "vue";
import VirtualList from "vue-virtual-scroll-list";

export default {
    components: {
        LoadingSpan,
        VirtualList,
    },
    props: {
        offset: { type: Number, default: 0 },
        loading: { type: Boolean, default: false },
        items: { type: Array, default: null },
        queryKey: { type: String, default: null },
    },
    setup() {
        const listing = ref(null);
        const { height } = useElementBounding(listing);

        const estimatedItemHeight = 40;
        const estimatedItemCount = computed(() => {
            const baseCount = Math.ceil(height.value / estimatedItemHeight);
            return baseCount + 20;
        });

        return { listing, estimatedItemHeight, estimatedItemCount };
    },
    data() {
        return {
            previousStart: undefined,
        };
    },
    watch: {
        queryKey() {
            this.listing.scrollToOffset(0);
        },
    },
    methods: {
        onScroll() {
            const rangeStart = this.listing.range.start;
            if (this.previousStart !== rangeStart) {
                this.previousStart = rangeStart;
                this.$emit("scroll", rangeStart);
            }
        },
        getOffset() {
            return this.listing?.getOffset() || 0;
        },
    },
};
</script>

<style scoped lang="scss">
@import "scss/mixins.scss";
.listing-layout {
    .listing {
        @include absfill();
        scroll-behavior: smooth;
        overflow-y: scroll;
        overflow-x: hidden;
    }
}
</style>
