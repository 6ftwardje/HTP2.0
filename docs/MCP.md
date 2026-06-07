# Supabase MCP (Model Context Protocol)

This project is set up to use the **Supabase MCP server** so Cursor (or other MCP clients) can talk to your Supabase project: run SQL, list tables, apply migrations, generate types, etc.

## Connection

- **MCP server:** Supabase remote server at `https://mcp.supabase.com/mcp`
- **Project:** Vul de nieuwe project-ref in via `project_ref=jouw-project-ref` (uit `NEXT_PUBLIC_SUPABASE_URL`).

## Cursor setup

1. **Config**
   - Either use the project-level `.cursor/mcp.json` in this repo, or add the same server in **Cursor Settings → Tools & MCP** (or your user `~/.cursor/mcp.json`).

2. **First-time auth**
   - When you first use a Supabase MCP tool, Cursor will open a browser to log in to Supabase and grant access. Choose the organization that contains this project.

3. **Restart**
   - After adding or changing MCP config, restart Cursor so it picks up the server.

## Useful prompts

- “What tables are in the database? Use MCP tools.”
- “List migrations for this project.”
- “Generate TypeScript types from the current schema.”

## Security

- Use this MCP with **development** data, not production.
- Prefer **project-scoped** URL (`project_ref=...`) and **read-only** if you only need queries:  
  `https://mcp.supabase.com/mcp?project_ref=jouw-project-ref&read_only=true`
- See [Supabase MCP security](https://supabase.com/mcp#security-risks) for full guidance.

## Reference

- [Supabase MCP](https://supabase.com/mcp)
- [Cursor MCP docs](https://cursor.com/docs/mcp)
