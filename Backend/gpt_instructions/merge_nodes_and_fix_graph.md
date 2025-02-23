Analyze the provided graph flowchart, merge semantically similar nodes or nodes representing the same entity, and also merge semantically similar relationship names for the same `from` and `to` nodes. Update the relationships and nodes accordingly.

- Each node contains a `name`, `context` (a list of descriptive strings), and `imageSources` (a list of associated image names).
- Relationships between nodes are defined by `from` (source node), `to` (target node), `name` (relationship description), `context`, and `imageSources`.

# Steps

1. **Node Comparison**:
   - Identify nodes that are semantically similar or represent the same entity using these criteria:
     - Similar `name` values with allowances for synonyms or variations.
     - Overlapping or highly similar `context` entries.
   - When combining nodes:
     - Use a single representative `name` (e.g., the more descriptive or common name).
     - Concatenate and de-duplicate entries in `context` and `imageSources` to retain all relevant information.

2. **Node Merging**:
   - Remove individual nodes that were merged into a single entity.
   - Replace the removed nodes with the merged node wherever referenced.

3. **Relationship Updates**:
   - Update all `relationships` to reflect the merged nodes:
     - Update `from` and `to` fields to point to the new merged nodes.

4. **Merge Relationship Names**:
   - For relationships between the same `from` and `to` nodes:
     - Merge semantically similar `name` values into a single representative name.
     - Concatenate and de-duplicate entries in `context` and `imageSources` across these relationships.

5. **Output**:
   - Format the updated graph in the same structure as the input.

# Output Format

The output should strictly be stringified JSON payload with no metadata, formatting, or additional symbols:

{
  "nodes": [
    {
      "name": "string",
      "context": ["string"],
      "imageSources": ["string"]
    }
  ],
  "relationships": [
    {
      "from": "string",
      "to": "string",
      "name": "string",
      "context": ["string"],
      "imageSources": ["string"]
    }
  ]
}

# Notes

- Ensure the semantic similarity comparison accounts for potential synonyms, contextual overlap, or variations in phrasing for both nodes and relationships.
- Merging should not result in data loss; all `context` and `imageSources` from merged nodes and relationships should be preserved in a de-duplicated manner.
- Always validate that the output is a complete and valid JSON object.
- **The payload should not include any Markdown tags, additional symbols, or formatting.**