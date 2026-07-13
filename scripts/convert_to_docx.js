const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, WidthType, BorderStyle, TableCellWidth,
        TableBorders, convertInchesToTwip } = require('docx');

// Read the translated text file
const textContent = fs.readFileSync('/home/mimo/pdf-to-text/output/BEI_EN.txt', 'utf-8');

// Parse the text content
function parseContent(text) {
    const lines = text.split('\n');
    const elements = [];
    let currentTable = null;
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip empty lines
        if (trimmedLine === '') {
            if (currentTable) {
                // End of table
                elements.push(createTable(tableRows));
                currentTable = null;
                tableRows = [];
            }
            continue;
        }

        // Check for table rows (start with |)
        if (trimmedLine.startsWith('|')) {
            if (!currentTable) {
                currentTable = true;
                tableRows = [];
            }
            // Parse table row
            const cells = trimmedLine.split('|').filter(cell => cell.trim() !== '');
            if (cells.length > 0 && !cells.every(c => c.trim().match(/^[-:]+$/))) {
                tableRows.push(cells.map(c => c.trim()));
            }
            continue;
        }

        // Check for horizontal rules
        if (trimmedLine.match(/^---+$/)) {
            elements.push(createHorizontalRule());
            continue;
        }

        // Check for headings
        if (trimmedLine.startsWith('# ')) {
            elements.push(createHeading(trimmedLine.substring(2), HeadingLevel.TITLE));
            continue;
        }
        if (trimmedLine.startsWith('## ')) {
            elements.push(createHeading(trimmedLine.substring(3), HeadingLevel.HEADING_1));
            continue;
        }
        if (trimmedLine.startsWith('### ')) {
            elements.push(createHeading(trimmedLine.substring(4), HeadingLevel.HEADING_2));
            continue;
        }
        if (trimmedLine.startsWith('#### ')) {
            elements.push(createHeading(trimmedLine.substring(5), HeadingLevel.HEADING_3));
            continue;
        }

        // Check for bullet points
        if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            elements.push(createBulletPoint(trimmedLine.substring(2)));
            continue;
        }

        // Check for numbered lists
        if (trimmedLine.match(/^\d+\.\s/)) {
            elements.push(createNumberedItem(trimmedLine));
            continue;
        }

        // Regular paragraph
        elements.push(createParagraph(trimmedLine));
    }

    // Handle any remaining table
    if (currentTable && tableRows.length > 0) {
        elements.push(createTable(tableRows));
    }

    return elements;
}

function createHeading(text, level) {
    return new Paragraph({
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: level === HeadingLevel.TITLE ? 32 : level === HeadingLevel.HEADING_1 ? 28 : 24
            })
        ],
        heading: level,
        alignment: level === HeadingLevel.TITLE ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 200 }
    });
}

function createParagraph(text) {
    // Handle bold text marked with **
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    const children = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({
                text: part.slice(2, -2),
                bold: true
            });
        }
        return new TextRun({
            text: part
        });
    });

    return new Paragraph({
        children: children,
        spacing: { after: 120 }
    });
}

function createBulletPoint(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text: '• ' + text
            })
        ],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.5) }
    });
}

function createNumberedItem(text) {
    return new Paragraph({
        children: [
            new TextRun({
                text: text
            })
        ],
        spacing: { after: 80 },
        indent: { left: convertInchesToTwip(0.5) }
    });
}

function createHorizontalRule() {
    return new Paragraph({
        children: [
            new TextRun({
                text: '________________________________________________________________________________'
            })
        ],
        spacing: { after: 200, before: 200 }
    });
}

function createTable(rows) {
    if (rows.length === 0) return createParagraph('');

    const table = new Table({
        rows: rows.map((row, rowIndex) =>
            new TableRow({
                children: row.map((cell, colIndex) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: cell,
                                        bold: rowIndex === 0, // Header row bold
                                        size: 20
                                    })
                                ]
                            })
                        ],
                        width: {
                            size: Math.floor(100 / row.length),
                            type: WidthType.PERCENTAGE
                        },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1 },
                            bottom: { style: BorderStyle.SINGLE, size: 1 },
                            left: { style: BorderStyle.SINGLE, size: 1 },
                            right: { style: BorderStyle.SINGLE, size: 1 }
                        }
                    })
                )
            })
        )
    });

    return table;
}

async function createDocument() {
    const elements = parseContent(textContent);

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: convertInchesToTwip(1),
                        right: convertInchesToTwip(1),
                        bottom: convertInchesToTwip(1),
                        left: convertInchesToTwip(1)
                    }
                }
            },
            children: elements
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync('/home/mimo/pdf-to-text/output/BEI_EN.docx', buffer);
    console.log('DOCX file created successfully at /home/mimo/pdf-to-text/output/BEI_EN.docx');
}

createDocument().catch(console.error);
