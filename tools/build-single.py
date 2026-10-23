#!/usr/bin/env python3
"""把 index.html、css、data、js 打包成單一 HTML 檔。

用法：python3 tools/build-single.py [輸出檔] [--fragment]
  --fragment  輸出不含 <!doctype>/<html>/<head>/<body> 的片段（給 Claude Artifact 預覽用）
"""
import base64
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
fragment = "--fragment" in sys.argv
out = pathlib.Path(args[0]) if args else root / "dist" / "index.html"

html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "css/style.css").read_text(encoding="utf-8")
data = (root / "data/faculty.js").read_text(encoding="utf-8")
main = (root / "js/main.js").read_text(encoding="utf-8")

# 單一檔案沒有 img/ 資料夾可讀，把照片等相對路徑圖檔內嵌成 data URI
def inline_img(m):
    path = root / m.group(1)
    if not path.exists():
        return m.group(0)
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    return '"data:%s;base64,%s"' % (mime, base64.b64encode(path.read_bytes()).decode())
data = re.sub(r'"(img/[^"]+\.(?:jpg|jpeg|png))"', inline_img, data)

# 允許網址帶 ?v= 版本號
html = re.sub(r'<link rel="stylesheet" href="css/style\.css(?:\?v=\w+)?">', lambda m: f"<style>\n{css}\n</style>", html)
html = re.sub(r'<script src="data/faculty\.js(?:\?v=\w+)?"></script>', lambda m: f"<script>\n{data}\n</script>", html)
html = re.sub(r'<script type="module" src="js/main\.js(?:\?v=\w+)?"></script>', lambda m: f'<script type="module">\n{main}\n</script>', html)

if fragment:
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', "", head)
    title = re.search(r"<title>.*?</title>", head).group(0)
    head = head.replace(title, "", 1)
    html = title + "\n" + head.strip() + "\n" + body.strip() + "\n"

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
