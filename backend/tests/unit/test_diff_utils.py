from app.services.diff_utils import parse_diff_lines

DIFF = """diff --git a/src/a.py b/src/a.py
index 111..222 100644
--- a/src/a.py
+++ b/src/a.py
@@ -1,4 +1,5 @@
 import os
-import sys
+import json
+import re
 
 def f():
@@ -20,2 +21,3 @@ def g():
     pass
+    return 1
 end
diff --git a/old.txt b/old.txt
deleted file mode 100644
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/new.md b/new.md
--- /dev/null
+++ b/new.md
@@ -0,0 +1,2 @@
+# hi
+there
\\ No newline at end of file
"""


def test_added_and_context_lines_mapped_to_new_file_numbers():
    f = parse_diff_lines(DIFF)
    assert f["src/a.py"] == {1, 2, 3, 4, 5, 21, 22, 23}      # removed line 2 ("import sys") has no new number
    assert f["new.md"] == {1, 2}


def test_deleted_files_have_no_commentable_lines():
    assert "old.txt" not in parse_diff_lines(DIFF)


def test_empty_and_garbage():
    assert parse_diff_lines("") == {}
    assert parse_diff_lines("not a diff\n+++ nothing") == {"nothing": set()}
