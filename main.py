try:
    from lark import Lark, Tree, Token
except ImportError as e:
    raise ImportError("The 'lark' library is required. Install it with 'pip install lark-parser'.") from e

# ==========================================
# 1. THE V-SCRIPT GRAMMAR
# ==========================================
V_SCRIPT_GRAMMAR = """
    ?start : block

    block  : statement*

    ?statement : assign_stmt
               | print_stmt
               | while_stmt

    assign_stmt : ID "=" expr
    print_stmt  : "print" expr
    while_stmt  : "while" condition "{" block "}"

    # Condition rules for loops
    condition   : expr ">" expr  -> gt
                | expr "<" expr  -> lt
                | expr "==" expr -> eq

    # Math with standard operator precedence
    ?expr   : term
            | expr "+" term   -> add
            | expr "-" term   -> sub

    ?term   : factor
            | term "*" factor -> mul
            | term "/" factor -> div

    ?factor : NUMBER          -> num
            | ID              -> var
            | "(" expr ")"

    %import common.CNAME -> ID
    %import common.NUMBER
    %import common.WS
    %ignore WS
"""

# ==========================================
# 2. THE INTERPRETER ENGINE (The Backend)
# ==========================================
class VScriptInterpreter:
    def __init__(self):
        # Environment dictionary to act as our language's RAM memory
        self.env = {}  

    def execute(self, node):
        """Walks and executes the statements in the AST"""
        if not isinstance(node, Tree):
            return node

        if node.data == 'block':
            for statement in node.children:
                self.execute(statement)
                
        elif node.data == 'assign_stmt':
            var_name = str(node.children[0])
            value = self.evaluate_expr(node.children[1])
            self.env[var_name] = value
            
        elif node.data == 'print_stmt':
            value = self.evaluate_expr(node.children[0])
            print(f"[V-Script Output]: {value}")
            
        elif node.data == 'while_stmt':
            condition_node = node.children[0]
            block_node = node.children[1]
            
            # Keep looping in Python while the V-Script condition is True
            while self.evaluate_condition(condition_node):
                self.execute(block_node)

    def evaluate_condition(self, node):
        """Resolves comparison branches to True or False"""
        left = self.evaluate_expr(node.children[0])
        right = self.evaluate_expr(node.children[1])
        
        if node.data == 'gt': return left > right
        if node.data == 'lt': return left < right
        if node.data == 'eq': return left == right
        return False

    def evaluate_expr(self, node):
        """Resolves math tokens and variable lookups"""
        # Base cases: if it's a raw Token leaf from Lark
        if isinstance(node, Token):
            return float(node)
            
        if node.data == 'num':
            return float(node.children[0])
            
        elif node.data == 'var':
            var_name = str(node.children[0])
            if var_name in self.env:
                return self.env[var_name]
            raise NameError(f"Runtime Error: Variable '{var_name}' is not defined.")

        # Recursive case: Evaluate left and right sub-trees for operations
        left = self.evaluate_expr(node.children[0])
        right = self.evaluate_expr(node.children[1])
        
        if node.data == 'add': return left + right
        if node.data == 'sub': return left - right
        if node.data == 'mul': return left * right
        if node.data == 'div': return left / right


# ==========================================
# 3. RUNNING THE INTERPRETER
# ==========================================
if __name__ == "__main__":
    # Initialize Lark with our custom grammar
    v_parser = Lark(V_SCRIPT_GRAMMAR, parser='lalr')
    interpreter = VScriptInterpreter()

    # The program code we want to compile and run
    program_source = """
    count = 5
    result = 1
    
    while count > 1 {
        result = result * count
        count = count - 1
    }
    
    print result
    """

    print("--- Launching V-Script Interpreter ---")
    try:
        # Step 1: Lark parses the raw text into a structural AST
        ast = v_parser.parse(program_source)
        
        # Step 2: Our backend execution engine runs the AST
        interpreter.execute(ast)
        
    except Exception as e:
        print(f"Compilation/Execution Error: {e}")