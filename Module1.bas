Attribute VB_Name = "Module2"
Sub kedua()
file = Application.GetOpenFilename("Jpg(*.jpg),*.jpg")
If file <> False Then
On Error Resume Next
ActiveSheet.Shapes("gbr").Delete

Set pigura = ActiveSheet.Shapes.AddShape(msoShapeRectangle, 0, 0, 100, 100)
ActiveCell.Select
With pigura
    .nama = "Gbr"
    .Left = ActiveCell.Lefta
    .Top = ActiveCell.Top
    .Fill.UserPicture file
End With
End If
End Sub
