Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "node """ & strPath & "\server.mjs""", 0, False
WScript.Sleep 2000
WshShell.Run "cmd.exe /c start http://localhost:3005", 0, False
