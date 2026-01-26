# show_functional_structure.py - FIXED VERSION
from pathlib import Path

def should_include(path):
    """Check if path should be included in the structure"""
    # EXCLUDE these (auto-generated/build files)
    exclude_dirs = {
        'node_modules', '.next', '.git', '.firebase', '.vercel', 
        '.github', '__pycache__', 'dist', 'build', '.cache',
        '.vscode', '.idea', '.DS_Store', 'coverage', '.yarn', 'dev-tools', 'supabase', 'database'
    }
    
    exclude_files = {
        '.DS_Store', 'Thumbs.db', '.gitignore', '.gitattributes',
        '.env', '.env.local', '.env.production', 'package-lock.json',
        'yarn.lock', 'pnpm-lock.yaml', '*.log', '*.tmp'
    }
    
    # EXCLUDE file extensions (auto-generated)
    exclude_extensions = {'.map', '.log', '.tmp', '.cache', '.ico', '.png', '.jpg', '.svg'}
    
    # Check exclusions
    if any(part in exclude_dirs for part in path.parts):
        return False
    
    if path.name in exclude_files:
        return False
    
    if path.suffix in exclude_extensions:
        return False
    
    # EXCLUDE specific auto-generated files
    auto_generated_files = {
        'asset-manifest.json', 'robots.txt', 'manifest.json',
        'favicon.ico', 'logo192.png', 'logo512.png', '*.css.map',
        '*.js.map', 'LICENSE.txt', 'reportWebVitals.ts',
        'setupTests.ts', 'App.test.tsx', 'react-app-env.d.ts'
    }
    
    for pattern in auto_generated_files:
        if pattern.startswith('*'):
            if path.name.endswith(pattern[1:]):
                return False
        elif path.name == pattern:
            return False
    
    # EXCLUDE build/static directories completely
    if 'build' in path.parts or 'static' in path.parts:
        return False
    
    # INCLUDE everything else (no whitelist filtering)
    return True

def show_clean_structure(target_path=None):
    if target_path is None:
        base_path = Path(__file__).parent  # Current directory
    else:
        base_path = Path(target_path)  # Specified directory
    
    print("📁 PROJECT STRUCTURE (Source & Config Files Only):")
    print("=" * 60)
    
    # Track shown directories to avoid duplicates
    shown_dirs = set()
    
    for path in sorted(base_path.rglob('*')):
        if not should_include(path):
            continue
        
        # Show parent directories first
        current = path
        dirs_to_show = []
        while current != base_path:
            if current.is_dir() and current not in shown_dirs:
                dirs_to_show.append(current)
                shown_dirs.add(current)
            current = current.parent
        
        # Print directories (deepest first)
        for dir_path in reversed(dirs_to_show):
            level = len(dir_path.relative_to(base_path).parts)
            indent = '  ' * (level - 1)
            print(f"{indent}📁 {dir_path.name}/")
        
        # Print file
        if path.is_file():
            level = len(path.relative_to(base_path).parts)
            indent = '  ' * (level - 1)
            print(f"{indent}📄 {path.name}")

def show_summary(target_path=None):
    """Show summary of what's actually in key directories"""
    if target_path is None:
        base_path = Path(__file__).parent
    else:
        base_path = Path(target_path)
    
    print("\n🔍 ACTUAL DIRECTORY CONTENTS (No filtering):")
    print("=" * 60)
    
    # Get all immediate subdirectories, excluding common dependency folders
    exclude_dirs = {'node_modules', '.git', '.next', 'dist', 'build', '.cache', '.vscode', '.idea'}
    try:
        items = [item for item in base_path.iterdir() if item.is_dir() and item.name not in exclude_dirs]
        if items:
            for item in sorted(items, key=lambda x: x.name):
                print(f"\n📂 {item.name}/")
                try:
                    sub_items = list(item.iterdir())
                    for sub_item in sorted(sub_items, key=lambda x: (not x.is_dir(), x.name)):
                        if sub_item.is_dir():
                            print(f"  📁 {sub_item.name}/")
                        else:
                            print(f"  📄 {sub_item.name}")
                except PermissionError:
                    print("  (Permission denied)")
        else:
            print("\nNo subdirectories found.")
    except Exception as e:
        print(f"Error reading directory: {e}")

if __name__ == "__main__":
    import sys
    
    # Allow command line argument for target directory
    target_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    show_clean_structure(target_path)
    show_summary(target_path)