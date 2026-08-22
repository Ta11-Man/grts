' GRTS Silent Background Launcher (Windows)
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run "pythonw -m uvicorn main:app --app-dir backend --port 8000", 0, False
WScript.Sleep 600
WshShell.Run """" & ScriptDir & "\extension\dashboard.html""", 1, False
