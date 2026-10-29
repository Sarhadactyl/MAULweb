"""builds the page preview"""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import json
import re

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'p', 'div', 'section', 'article', 'li', 'h1', 'h2', 'h3', 'h4', 'br', 'tr'}
SKIP = {'script', 'style', 'nav', 'footer', 'dialog', 'template'}

class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.text, self.headings, self.title = [], [], [], []
        self.description = ''
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == 'meta' and (attrs.get('name') == 'description' or attrs.get('property') == 'og:description'):
            self.description = self.description or attrs.get('content', '')
        hidden = (self.stack and self.stack[-1][1]) or tag in SKIP or attrs.get('id') == 'navbar' or attrs.get('aria-hidden') == 'true' or 'hidden' in attrs or attrs.get('class', '') in {'featured-spotlight', 'link-warning'}
        if tag not in VOID:
            self.stack.append((tag, bool(hidden)))
        if tag in BLOCK and not hidden:
            self.text.append('\n')
    def handle_endtag(self, tag):
        if tag in BLOCK:
            self.text.append('\n')
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                self.stack = self.stack[:index]
                break
    def handle_data(self, value):
        tags = [item[0] for item in self.stack]
        if 'title' in tags:
            self.title.append(value)
        if 'body' not in tags or (self.stack and self.stack[-1][1]):
            return
        self.text.append(value)
        if any(tag in {'h1', 'h2', 'h3'} for tag in tags):
            self.headings.append(value)

def build(roots):
    pages = {}
    for root in roots:
        root = Path(root)
        for file in sorted(root.rglob('*.html')):
            relative = file.relative_to(root)
            if any(part in {'components', 'includes', 'MAULweb', '.git'} for part in relative.parts) or 'preview' in file.stem or file.name == '404.html':
                continue
            parser = PageText()
            parser.feed(file.read_text(encoding='utf-8-sig', errors='replace'))
            text = '\n'.join(line for value in ''.join(parser.text).split('\n') if (line := re.sub(r'\s+', ' ', value).strip()))[:100000]
            if not text:
                continue
            url = '/' + relative.as_posix()
            if url.endswith('/index.html'):
                url = url[:-len('index.html')]
            pages[url] = {
                'url': url,
                'title': re.sub(r'\s+', ' ', ''.join(parser.title)).strip() or file.stem,
                'description': parser.description,
                'headings': re.sub(r'\s+', ' ', ' '.join(parser.headings)).strip(),
                'text': text,
            }
    return {'pages': list(pages.values())}

if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('roots', nargs='+', help='Your website source folder; later folders override earlier ones')
    args.add_argument('--output', default=str(Path(__file__).resolve().parent.parent / 'data' / 'search-index.json'))
    options = args.parse_args()
    output = Path(options.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    data = build(options.roots)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Indexed {len(data["pages"])} public pages: {output}')
