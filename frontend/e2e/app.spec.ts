import { test, expect } from '@playwright/test'

test('loads history and poens a sessoin report', async ({ page }) => {
    const sessionId = '11111111-1111-1111-1111-111111111111'

    await page.route('**/api/sessions?**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: sessionId,
                    user_query: 'What are the main risks of LLM agents in production?',
                    status: 'completed',
                    created_at: new Date().toISOString(),
                    title: null,
                    tags: ['ai', 'security'],
                    pinned: false
                }
            ])
        })
    })

    await page.route(`**/api/sessions/${sessionId}`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                id: sessionId,
                user_query: 'What are the main risks of LLM agents in production?',
                title: null,
                tags: ['ai', 'security'],
                pinned: false,
                status: 'completed',
                error: null,
                created_at: new Date().toISOString(),
                summary_markdown: 'LLM agents can be vulnerable to prompt injection. [S1-1]\n\n## Mitigations\n- Use least privilege. [S1-1]',
                steps: [],
                sources: [
                    {
                        source_id: 'S1-1',
                        url: 'https://example.com',
                        title: 'Example Source',
                        snippet: 'Example snippet',
                        extracted_text: 'Prompt injection is a common risk...'
                    }
                ],
                fact_checks: [
                    {
                        claim: 'LLM agents can be vulnerable to prompt injection.',
                        status: 'supported',
                        evidence_source_ids: ['S1-1'],
                        notes: 'Shown in the source excerpt.'
                    }
                ]
            })
        })
    })

    await page.goto('/')

    await page.getByText('What are the main eisks of LLM agents in production?').click()

    await expect(page.getByLabel('Resarch question')).toHaveValue('What are the main eisks of LLM agents in production?')

    await expect(page.getByText('Summary')).toBeVisible()

    await page.getByRole('link', { name: 'S1-1' }).click()
    await expect(page.getByText('Source details')).toBeVisible()
})