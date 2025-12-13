# Windows Selection Screenshot Script
# Creates a transparent overlay for drag-selection of screen area

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Global variables
$startPoint = $null
$endPoint = $null
$selecting = $false
$tempFile = $args[0]  # Passed from Node.js

# Create overlay form
$form = New-Object Windows.Forms.Form
$form.FormBorderStyle = 'None'
$form.WindowState = 'Maximized'
$form.BackColor = [System.Drawing.Color]::FromArgb(50, 0, 0, 0)  # Semi-transparent black
$form.Opacity = 0.3
$form.TopMost = $true
$form.Cursor = [System.Windows.Forms.Cursors]::Cross

# Create graphics for drawing selection rectangle
$graphics = $null
$pen = New-Object Drawing.Pen ([System.Drawing.Color]::Red), 2

# Mouse events
$form.add_MouseDown({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:startPoint = $e.Location
        $script:endPoint = $e.Location
        $script:selecting = $true
    }
})

$form.add_MouseMove({
    param($sender, $e)
    if ($script:selecting) {
        $script:endPoint = $e.Location
        $form.Refresh()
    }
})

$form.add_MouseUp({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $script:selecting) {
        $script:selecting = $false
        $script:endPoint = $e.Location
        $form.Close()
    }
})

$form.add_Paint({
    param($sender, $e)
    if ($script:startPoint -and $script:endPoint) {
        $rect = New-Object Drawing.Rectangle (
            [Math]::Min($script:startPoint.X, $script:endPoint.X),
            [Math]::Min($script:startPoint.Y, $script:endPoint.Y),
            [Math]::Abs($script:endPoint.X - $script:startPoint.X),
            [Math]::Abs($script:endPoint.Y - $script:startPoint.Y)
        )
        $e.Graphics.DrawRectangle($pen, $rect)
    }
})

# Show form and wait
$form.ShowDialog()

# After selection, capture the area
if ($startPoint -and $endPoint) {
    $x = [Math]::Min($startPoint.X, $endPoint.X)
    $y = [Math]::Min($startPoint.Y, $endPoint.Y)
    $width = [Math]::Abs($endPoint.X - $startPoint.X)
    $height = [Math]::Abs($endPoint.Y - $startPoint.Y)

    if ($width -gt 10 -and $height -gt 10) {  # Minimum size check
        # Capture screen area
        $bounds = New-Object Drawing.Rectangle $x, $y, $width, $height
        $bitmap = New-Object Drawing.Bitmap $width, $height
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)

        # Save to file
        $bitmap.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

# Cleanup
if ($graphics) { $graphics.Dispose() }
$pen.Dispose()