export type ClaimStatus = 'supported' | 'unsupported' | 'uncertain'

export interface Source {
    source_id: string
    url: string
    title?: string | null
    snippet?: string | null
    extracted_text?: string | null
}

export interface AgentStepDebug {
    agent: string
    input_preview?: string | null
    output_preview?: string | null
    duration_ms: number
}

export interface ClaimCheck {
    claim: string
    status: ClaimStatus
    evidence_source_ids: string[]
    notes?: string | null
}

export interface ResearchResponse {
    session_id?: string | null
    query: string
    needs_clarification: boolean
    clarifying_question: string[]
    subquestions: string[]
    summary_markdown?: string | null
    sources: Source[]
    fact_checks: ClaimCheck[]
    debug_step: AgentStepDebug[]
}

export interface SessionListItem {
    id: string
    user_query: string
    status: string
    created_at: string
}

export interface SessionDetail {
    id: string
    user_query: string
    status: string
    error?: string | null
    created_at: string
    summary_markdown?: string | null
    steps: Array<{
        agent_name: string
        input?: Record<string, unknown> | null
        output?: Record<string, unknown> | null
        tokens_used?: number | null
        duration_ms: number
        created_at: string
    }>
    sources: Source[]
    fact_checks: ClaimCheck[]
}

export type ProgressEvent = {
    stage: 'planner' | 'researcher' | 'summarizer' | 'fact_checker' | 'pipeline' | string
    status: string
    [k: string]: unknown
}