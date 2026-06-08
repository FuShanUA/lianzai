import os
import sys
import argparse
import io

# Setup paths to include common library for llm_utils
STYLE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.dirname(STYLE_DIR)
COMMON_DIR = os.path.join(TOOLS_DIR, "common")

sys.path.append(COMMON_DIR)

try:
    import llm_utils
except ImportError:
    print("❌ Error: llm_utils.py not found in common directory.")
    sys.exit(1)

def load_file(path):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""

def style_text(text, model_name="gemini-3-flash"):
    # Load Knowledge (心法)
    rules_path = os.path.join(STYLE_DIR, "README.md")
    knowledge = load_file(rules_path)

    # Load Hard Constraints (剑法)
    constraints_path = os.path.join(COMMON_DIR, "HARD_CONSTRAINTS.md")
    constraints = load_file(constraints_path)

    prompt = f"""
You are a professional editor and translator. Your task is to polish, humanize, and "remove the AI flavor" from the provided text.

### SYSTEM PROMPT / KNOWLEDGE (心法)
{knowledge}

### HARD CONSTRAINTS (剑法 - 禁用词与硬规则)
{constraints}

### TASK
Please rewrite the following text to make it sound human, professional, and clear.
- Follow the Role and Audience defined in the knowledge base.
- Strictly avoid the words and patterns listed in the Hard Constraints.
- Use the Good/Bad examples as a guide for tone and structure.
- Maintain the original Markdown structure if present.

### INPUT TEXT
{text}

### OUTPUT (Only provide the polished text)
"""

    client = llm_utils.get_client()
    return client.generate_content(prompt, model_name=model_name)

def main():
    parser = argparse.ArgumentParser(description="Standalone WritingStyle Polisher")
    parser.add_argument("input", help="Path to the input text file (or '-' for stdin)")
    parser.add_argument("--model", default="gemini-3-flash", help="LLM Model to use")
    parser.add_argument("--out", help="Output file path (optional)")

    args = parser.parse_args()

    # Read input
    if args.input == "-":
        input_text = sys.stdin.read()
    else:
        if not os.path.exists(args.input):
            print(f"❌ Error: File not found: {args.input}")
            sys.exit(1)
        input_text = load_file(args.input)

    if not input_text.strip():
        print("⚠️ Warning: Input text is empty.")
        return

    print(f"🚀 Polishing text using WritingStyle rules (Model: {args.model})...")
    result = style_text(input_text, model_name=args.model)

    if result:
        if args.out:
            with open(args.out, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"✅ Success! Polished text saved to: {args.out}")
        else:
            print("\n--- POLISHED TEXT ---\n")
            print(result)
            print("\n---------------------\n")
    else:
        print("❌ Error: Failed to generate polished text.")

if __name__ == "__main__":
    main()