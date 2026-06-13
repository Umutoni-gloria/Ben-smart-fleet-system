import os
import re

directory = r"c:\Users\user2\ben-supply-fleet\app\(dashboard)"
new_class = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-orange-500 transition-colors shadow-sm mb-4 group dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:text-orange-400"
svg_icon = '<svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>'

count = 0
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') and 'Sidebar' not in file:
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Match: className="text-sm ..." ... > ← Or className="text-sm ...">← 
            # We look for a <a> or <button> or <Link> that has a className ending just before >\s*←
            
            pattern = re.compile(r'className="([^"]*)"([^>]*)>\s*←')
            
            def repl(match):
                old_class = match.group(1)
                other_attrs = match.group(2)
                
                # Check if it's already updated to prevent double runs
                if "rounded-full" in old_class:
                    return match.group(0) # Keep as is if already a pill
                
                return f'className="{new_class}"{other_attrs}>{svg_icon} '
                
            new_content = pattern.sub(repl, content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                print(f"Updated {path}")

print(f"Total updated: {count}")
