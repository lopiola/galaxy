<script setup lang="ts">
import { BFormInput } from "bootstrap-vue";
import { computed } from "vue";

import { filesDialog } from "@/utils/data";

import { FileSourceBrowsingMode, FilterFileSourcesOptions } from "./services";

interface Props {
    value: string;
    mode?: FileSourceBrowsingMode;
    requireWritable?: boolean;
    filterOptions?: FilterFileSourcesOptions;
}

interface SelectableFile {
    url: string;
}

const props = withDefaults(defineProps<Props>(), {
    mode: "file",
    requireWritable: false,
    filterOptions: undefined,
});

const emit = defineEmits<{
    (e: "input", value: string): void;
}>();

const currentValue = computed({
    get() {
        return props.value;
    },
    set(newValue) {
        emit("input", newValue);
    },
});

const selectFile = () => {
    const dialogProps = {
        mode: props.mode,
        requireWritable: props.requireWritable,
        filterOptions: props.filterOptions,
    };
    filesDialog((selected: SelectableFile) => {
        currentValue.value = selected?.url;
    }, dialogProps);
};

const placeholder = `Click to select ${props.mode}`;
</script>

<template>
    <BFormInput v-model="currentValue" class="directory-form-input" :placeholder="placeholder" @click="selectFile" />
</template>
