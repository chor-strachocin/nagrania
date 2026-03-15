#!/bin/bash

# Użycie: ./upload-sheet.sh gloria nuty.pdf

SONG_ID=$1
PDF_FILE=$2
BUCKET="choir-audio"

if [ -z "$SONG_ID" ] || [ -z "$PDF_FILE" ]; then
    echo "Użycie: ./upload-sheet.sh <song-id> <plik.pdf>"
    exit 1
fi

echo "📄 Konwertuję PDF na obrazy..."

# Konwersja PDF → JPG (150 DPI, dobra jakość dla nut)
pdftoppm -jpeg -r 150 "$PDF_FILE" temp-page

echo "☁️  Uploading do R2..."

# Upload wszystkich stron
page_num=1
for img in temp-page-*.jpg; do
    if [ -f "$img" ]; then
        wrangler r2 object put "$BUCKET/$SONG_ID/nuty-$page_num.jpg" --file "$img"
        echo "  ✓ Strona $page_num"
        ((page_num++))
    fi
done

# Cleanup
rm temp-page-*.jpg

echo ""
echo "✅ Gotowe! Dodaj do songs.json:"
echo ""
echo "  \"sheets\": {"
echo "    \"pages\": ["

page_num=1
total_pages=$((page_num - 1))
for ((i=1; i<=total_pages; i++)); do
    comma=""
    if [ $i -lt $total_pages ]; then
        comma=","
    fi
    echo "      \"https://pub-14992ccbb14b4c84a26df90b7cedd48f.r2.dev$SONG_ID/nuty-$i.jpg\"$comma"
done

echo "    ]"
echo "  }"