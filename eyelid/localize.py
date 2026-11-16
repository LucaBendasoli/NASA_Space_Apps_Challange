"""Prepare English markup with the original copy available for Portuguese."""
import html
from html.parser import HTMLParser
import json
import re


class LocalizedMarkup(HTMLParser):
    def __init__(self, source, translations):
        super().__init__(convert_charrefs=False)
        self.translations = translations
        self.parts = []
        self.stack = []
        self.feed(source)

    @property
    def markup(self):
        return ''.join(self.parts)

    def handle_starttag(self, tag, attrs):
        source = self.get_starttag_text()
        translated = {key: value for key, value in attrs
                      if key in ('title', 'aria-label', 'placeholder', 'alt') and value in self.translations}
        if translated:
            for key, value in translated.items():
                source = re.sub(r'('+key+r'=")[^"]*(")', lambda m: m[1]+html.escape(self.translations[value], quote=True)+m[2], source, count=1)
            source = source[:-1] + ' data-eyelid-attrs="' + html.escape(json.dumps(translated, ensure_ascii=False), quote=True) + '">'
        if tag not in {'meta','link','img','input','br','hr','source','area','base','col','embed','param','track','wbr'}:
            self.stack.append((tag, len(self.parts)))
        self.parts.append(source)

    def handle_startendtag(self, tag, attrs):
        self.parts.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        for index in range(len(self.stack)-1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break
        self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        key = data.strip()
        if self.stack and self.stack[-1][0] not in ('script','style') and key in self.translations:
            _, index = self.stack[-1]
            self.parts[index] = self.parts[index][:-1] + ' data-eyelid-copy="' + html.escape(key, quote=True) + '">'
            data = data.replace(key, html.escape(self.translations[key]), 1)
        self.parts.append(data)

    def handle_entityref(self, name):
        self.parts.append('&'+name+';')

    def handle_charref(self, name):
        self.parts.append('&#'+name+';')

    def handle_comment(self, data):
        self.parts.append('<!--'+data+'-->')

    def handle_decl(self, decl):
        self.parts.append('<!'+decl+'>')


def localize_markup(source, translations):
    return LocalizedMarkup(source, translations).markup
