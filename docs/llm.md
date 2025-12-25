# LLM Integration

Assess can use OpenAI to score essays and generate embeddings for short-answer scoring. Set environment variable `OPENAI_API_KEY` to enable.

Essay scoring: The implementation uses a small prompt to ask the model to return a JSON object like:

{ "score": 0.9, "feedback": "Good structure, needs more examples" }

Short-answer scoring: For robust short-answer checking, the system supports **embedding-based similarity** using OpenAI embeddings (model `text-embedding-3-small`) and cosine similarity. If `OPENAI_API_KEY` is not set or an embeddings call fails, the grader falls back to a token-overlap similarity as a safe fallback.

Security and cost: Embeddings are cheaper than full LLM scoring but still incur cost; consider caching embeddings, batching requests, or using a provider-agnostic embedding abstraction for production use.
