from utils.logger import get_logger

console = get_logger()

if __name__ == "__main__":
    console.print("Flowdesk Support Agent starting...", style="bold green")




from agents.graph import run_support_agent

result = run_support_agent("how do I invite someone to my workspace")

print(f"\nFinal Answer: {result['answer']}")
print(f"Confidence: {result['confidence']}")
print(f"Action: {result['action_taken']}")
print(f"Issue type: {result['issue_type']}")