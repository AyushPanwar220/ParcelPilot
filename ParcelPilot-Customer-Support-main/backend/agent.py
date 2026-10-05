import sqlite3
import json
import os
import re
from openai import OpenAI
import glob

def get_db_connection():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'parcelpilot.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def search_documents(query: str, user_context: str) -> str:
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    files = glob.glob(os.path.join(data_dir, '*.txt'))
    
    docs = []
    for f in files:
        filename = os.path.basename(f)
        if 'DEPRECATED' in filename: continue
        if 'Northstar' in filename and user_context != 'Northstar' and user_context != 'Internal': continue
        if 'LumenWorks' in filename and user_context != 'LumenWorks' and user_context != 'Internal': continue
            
        with open(f, 'r', encoding='utf-8') as text_file:
            docs.append({"filename": filename, "content": text_file.read()})
    
    query_terms = set(re.findall(r'\w+', query.lower()))
    scored = []
    for doc in docs:
        score = sum(1 for term in query_terms if term in doc['content'].lower())
        scored.append((score, doc))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    top_docs = scored[:3]
    
    results = []
    for score, doc in top_docs:
        results.append(f"--- Document: {doc['filename']} (relevance: {score}) ---\n{doc['content']}")
    
    return "\n\n".join(results)

def lookup_order(order_id: str, user_context: str) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_context == 'Internal':
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
    else:
        account_map = {'Northstar': 'ACCT-001', 'LumenWorks': 'ACCT-002'}
        account_id = account_map.get(user_context)
        if not account_id: return json.dumps({"error": "Unknown account context."})
        cursor.execute("SELECT * FROM orders WHERE order_id = ? AND account_id = ?", (order_id, account_id))
    row = cursor.fetchone()
    conn.close()
    if row: return json.dumps(dict(row))
    return json.dumps({"error": "Order not found."})

def lookup_ticket(ticket_id: str, user_context: str) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_context == 'Internal':
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ?", (ticket_id,))
    else:
        account_map = {'Northstar': 'ACCT-001', 'LumenWorks': 'ACCT-002'}
        account_id = account_map.get(user_context)
        if not account_id: return json.dumps({"error": "Unknown account context."})
        cursor.execute("SELECT * FROM tickets WHERE ticket_id = ? AND account_id = ?", (ticket_id, account_id))
    row = cursor.fetchone()
    conn.close()
    if row: return json.dumps(dict(row))
    return json.dumps({"error": "Ticket not found."})

def prepare_action(action_type: str, details: str, user_context: str) -> str:
    return json.dumps({
        "status": "REQUIRES_CONFIRMATION",
        "action_type": action_type,
        "details": details,
        "initiated_by": user_context,
        "message": "Please confirm this action in the UI before it is executed."
    })

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "Search the knowledge base for policies, agreements, and SOPs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_order",
            "description": "Look up order details.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"}
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_ticket",
            "description": "Look up ticket details.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "string"}
                },
                "required": ["ticket_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "prepare_action",
            "description": "Prepare action for confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {"type": "string"},
                    "details": {"type": "string"}
                },
                "required": ["action_type", "details"]
            }
        }
    }
]

SYSTEM_PROMPT = '''You are the ParcelPilot AI Support Assistant.

CURRENT USER CONTEXT: {user_context}
This means the person chatting is authenticated as a "{user_context}" user. You ALREADY KNOW who they are. Do NOT ask them to "check their contract" or "confirm which plan they are on". Apply their specific rules directly and confidently.

TRUST HIERARCHY (highest to lowest priority):
1. Customer-specific Enterprise Agreements (e.g., Northstar Logistics Enterprise Agreement, LumenWorks Service Agreement) — these OVERRIDE everything below when they conflict.
2. Current general policies (files marked CURRENT) — override SOPs.
3. Standard Operating Procedures (SOPs) — default fallback.
4. DEPRECATED documents — NEVER use these. Ignore them entirely.

RESPONSE FORMAT RULES:
- Be direct and confident. State the answer first, then cite the source.
- Use bullet points (- or *) for lists. NEVER use markdown tables (| pipes).
- Always cite the exact document filename and section number in brackets, e.g. [05_Northstar_Logistics_Enterprise_Agreement.txt, Section 2].
- When a customer agreement overrides an SOP, explicitly state: "Your enterprise agreement overrides the standard policy" and explain both rules briefly.
- Keep responses concise — 3 to 6 short paragraphs maximum.
- Use **bold** for key figures (amounts, deadlines, statuses).

TOOL USAGE RULES:
- Use search_documents to find policies and agreements before answering.
- Use lookup_order / lookup_ticket when the user asks about a specific order or ticket.
- Use prepare_action for ANY state-changing request (escalation, credit, cancellation). Never claim an action was performed — always route through prepare_action.
- If data is ambiguous or missing, say so explicitly. Do not guess.
'''

def run_agent(message: str, user_context: str):
    client = OpenAI()
    model_name = os.environ.get("MODEL_NAME", "llama3-70b-8192")
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(user_context=user_context)},
        {"role": "user", "content": message}
    ]
    
    tool_log = []
    
    for _ in range(5):
        response = client.chat.completions.create(model=model_name, messages=messages, tools=tools)
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        if not tool_calls:
            return {"reply": response_message.content, "tools_used": tool_log}
        
        messages.append(response_message)
        
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            tool_log.append(f"{function_name}")
            
            if function_name == "search_documents":
                result = search_documents(function_args.get("query", ""), user_context)
            elif function_name == "lookup_order":
                result = lookup_order(function_args.get("order_id", ""), user_context)
            elif function_name == "lookup_ticket":
                result = lookup_ticket(function_args.get("ticket_id", ""), user_context)
            elif function_name == "prepare_action":
                action_payload = json.loads(prepare_action(
                    function_args.get("action_type", ""),
                    function_args.get("details", ""),
                    user_context
                ))
                return {
                    "reply": "I have prepared the following action for your review. Please confirm or cancel below.",
                    "action_payload": action_payload,
                    "tools_used": tool_log
                }
            else:
                result = json.dumps({"error": "Unknown tool"})
                
            messages.append({"tool_call_id": tool_call.id, "role": "tool", "name": function_name, "content": str(result)})
    
    final_response = client.chat.completions.create(model=model_name, messages=messages)
    return {"reply": final_response.choices[0].message.content, "tools_used": tool_log}
