<template>
    <b-tabs v-if="invocation">
        <b-tab title="Summary" active>
            <WorkflowInvocationSummary
                :invocation="invocation"
                :index="index"
                :invocation-and-job-terminal="invocationAndJobTerminal"
                :invocation-scheduling-terminal="invocationSchedulingTerminal"
                :job-states-summary="jobStatesSummary"
                @invocation-cancelled="cancelWorkflowScheduling" />
        </b-tab>
        <b-tab title="Details">
            <WorkflowInvocationDetails
                :invocation="invocation"
                :invocation-and-job-terminal="invocationAndJobTerminal" />
        </b-tab>
        <!-- <b-tab title="Workflow Overview">
            <p>TODO: Insert readonly version of workflow editor here</p>
        </b-tab> -->
        <b-tab title="Export">
            <div v-if="invocationAndJobTerminal">
                <WorkflowInvocationExportOptions :invocation-id="invocation.id" />
            </div>
            <b-alert v-else variant="info" show>
                <LoadingSpan message="Waiting to complete invocation" />
            </b-alert>
        </b-tab>
    </b-tabs>
    <b-alert v-else variant="info" show>
        <LoadingSpan message="Loading invocation" />
    </b-alert>
</template>
<script>
import mixin from "components/JobStates/mixin";
import LoadingSpan from "components/LoadingSpan";
import JOB_STATES_MODEL from "utils/job-states-model";
import { mapActions, mapGetters } from "vuex";

import { cancelWorkflowScheduling } from "./services";

import WorkflowInvocationDetails from "./WorkflowInvocationDetails.vue";
import WorkflowInvocationExportOptions from "./WorkflowInvocationExportOptions.vue";
import WorkflowInvocationSummary from "./WorkflowInvocationSummary.vue";

export default {
    components: {
        LoadingSpan,
        WorkflowInvocationSummary,
        WorkflowInvocationDetails,
        WorkflowInvocationExportOptions,
    },
    mixins: [mixin],
    props: {
        invocationId: {
            type: String,
            required: true,
        },
        index: {
            type: Number,
            required: false,
            default: null,
        },
    },
    data() {
        return {
            stepStatesInterval: null,
            jobStatesInterval: null,
        };
    },
    computed: {
        ...mapGetters(["getInvocationById", "getInvocationJobsSummaryById"]),
        invocation: function () {
            return this.getInvocationById(this.invocationId);
        },
        invocationState: function () {
            return this.invocation?.state || "new";
        },
        invocationAndJobTerminal: function () {
            return !!(this.invocationSchedulingTerminal && this.jobStatesTerminal);
        },
        invocationSchedulingTerminal: function () {
            return (
                this.invocationState == "scheduled" ||
                this.invocationState == "cancelled" ||
                this.invocationState == "failed"
            );
        },
        jobStatesTerminal: function () {
            if (this.invocationSchedulingTerminal && this.JobStatesSummary?.jobCount === 0) {
                // no jobs for this invocation (think subworkflow or just inputs)
                return true;
            }
            return this.jobStatesSummary && this.jobStatesSummary.terminal();
        },
        jobStatesSummary() {
            const jobsSummary = this.getInvocationJobsSummaryById(this.invocationId);
            return !jobsSummary ? null : new JOB_STATES_MODEL.JobStatesSummary(jobsSummary);
        },
    },
    created: function () {
        this.pollStepStatesUntilTerminal();
        this.pollJobStatesUntilTerminal();
    },
    beforeDestroy: function () {
        clearTimeout(this.jobStatesInterval);
        clearTimeout(this.stepStatesInterval);
    },
    methods: {
        ...mapActions(["fetchInvocationForId", "fetchInvocationJobsSummaryForId"]),
        pollStepStatesUntilTerminal: function () {
            if (!this.invocation || !this.invocationSchedulingTerminal) {
                this.fetchInvocationForId(this.invocationId).then((response) => {
                    this.stepStatesInterval = setTimeout(this.pollStepStatesUntilTerminal, 3000);
                });
            }
        },
        pollJobStatesUntilTerminal: function () {
            if (!this.jobStatesTerminal) {
                this.fetchInvocationJobsSummaryForId(this.invocationId).then((response) => {
                    this.jobStatesInterval = setTimeout(this.pollJobStatesUntilTerminal, 3000);
                });
            }
        },
        onError: function (e) {
            console.error(e);
        },
        onCancel() {
            this.$emit("invocation-cancelled");
        },
        cancelWorkflowScheduling: function () {
            cancelWorkflowScheduling(this.invocationId).then(this.onCancel).catch(this.onError);
        },
    },
};
</script>
