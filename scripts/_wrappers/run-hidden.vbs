' scripts/_wrappers/run-hidden.vbs
'
' Founder 2026-09-10 · fully-hidden Windows shim for scheduled tasks.
' Every NEX-Lab-* Task Scheduler action calls this VBS with the target .cmd
' path as the single argument. WshShell.Run with intWindowStyle=0 + bWaitOnReturn=False
' means NO console window ever appears · task runs in the background.
'
' Usage from schtasks:
'   /TR "wscript.exe //B \"C:\Users\Victus\trades\scripts\_wrappers\run-hidden.vbs\" \"C:\Users\Victus\trades\scripts\_wrappers\run-lab-image.cmd\""
'
' Design notes:
'   · //B suppresses the WSH banner in case it were shown
'   · intWindowStyle=0 = SW_HIDE · window fully hidden
'   · bWaitOnReturn=False · scheduled task returns immediately so schtasks status stays healthy
'   · exec still runs the .cmd to completion in the background

If WScript.Arguments.Count < 1 Then
  ' Nothing to do · exit silently
  WScript.Quit 0
End If

Dim shell, cmdPath
Set shell = CreateObject("WScript.Shell")
cmdPath = WScript.Arguments(0)

' Wrap in cmd /c so the .cmd file runs in a cmd shell (no window)
' quotes preserved so paths with spaces work
shell.Run "cmd /c """ & cmdPath & """", 0, False

WScript.Quit 0
