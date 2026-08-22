' GRTS Silent Background Launcher (Windows)
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = ScriptDir
WshShell.Run "python """ & ScriptDir & "\scripts\grts_service.py"" stop", 0, True
