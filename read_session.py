"""Quick script to read a session's conversation history from PostgreSQL checkpoints."""

from agents.graph import app

def read_session(session_id: str):
    config = {"configurable": {"thread_id": session_id}}
    state = app.get_state(config)

    if not state or not state.values:
        print(f"No data found for session: {session_id}")
        return

    history = state.values.get("conversation_history", [])
    print(f"\n=== Session: {session_id} ===")
    print(f"Total messages: {len(history)}\n")

    for msg in history:
        role = msg.get("role", "unknown").upper()
        content = msg.get("content", "")
        print(f"[{role}]\n{content}\n")

    final = state.values.get("final_response")
    if final:
        print(f"Last confidence : {final.get('confidence')}")
        print(f"Last action     : {final.get('action_taken')}")
        print(f"Last issue type : {final.get('issue_type')}")


if __name__ == "__main__":
    read_session("test-session-001")
