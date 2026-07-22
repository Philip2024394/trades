-- Mate step 2: persist tool_calls per assistant message so /admin/mate
-- can show which tools ran per turn (debug + training signal).
--
-- Shape: JSONB array of { step, name, input, output, ok, ms }.
-- Empty array when Claude answered without tools.

ALTER TABLE public.hammerex_mate_messages
  ADD COLUMN IF NOT EXISTS tool_calls JSONB;

-- GIN index on tool call names so we can quickly query "how often
-- did Mate call get_extra_analytics this week" without table scans.
CREATE INDEX IF NOT EXISTS idx_mate_msg_tool_calls
  ON public.hammerex_mate_messages USING GIN (tool_calls);
