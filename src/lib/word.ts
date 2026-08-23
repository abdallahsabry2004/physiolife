export function generateWord(elementId: string, filename: string = "document.doc") {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // Clone the element to manipulate it without affecting the UI
  const clone = element.cloneNode(true) as HTMLElement;

  // We can add some basic styles to the clone if needed to preserve layout in Word
  // For example, removing elements that shouldn't be printed, if they have a specific class.
  const noPrint = clone.querySelectorAll('.no-print');
  noPrint.forEach(el => el.parentNode?.removeChild(el));

  // Get the HTML content
  const htmlContent = clone.outerHTML;

  // Create the Word document structure
  const header = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <style>
        body { font-family: 'Arial', sans-serif; color: black; background: white; }
        .text-gray-500 { color: #6b7280; }
        .text-gray-600 { color: #4b5563; }
        .text-gray-800 { color: #1f2937; }
        .text-black { color: #000000; }
        .text-\[\#0f766e\] { color: #0f766e; }
        .bg-gray-50 { background-color: #f9fafb; }
        
        .font-bold { font-weight: bold; }
        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        
        .text-xs { font-size: 0.75rem; }
        .text-sm { font-size: 0.875rem; }
        .text-lg { font-size: 1.125rem; }
        .text-xl { font-size: 1.25rem; }
        .text-2xl { font-size: 1.5rem; }
        .text-3xl { font-size: 1.875rem; }
        
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        
        .pb-6 { padding-bottom: 1.5rem; }
        .p-4 { padding: 1rem; }
        .p-5 { padding: 1.25rem; }
        .p-8 { padding: 2rem; }
        
        .border-b-2 { border-bottom: 2px solid #e5e7eb; }
        .border-t { border-top: 1px solid #e5e7eb; }
        .border-\[\#0f766e\] { border-color: #0f766e; }
        .border-2 { border: 2px solid #e5e7eb; }
        .border-gray-200 { border-color: #e5e7eb; }
        .rounded-xl { border-radius: 0.75rem; }
        
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        
        /* Layouts */
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-start { align-items: flex-start; }
        .items-center { align-items: center; }
        .gap-4 { gap: 1rem; }
        .text-right { text-align: right; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gap-y-4 { row-gap: 1rem; }
        .gap-x-8 { column-gap: 2rem; }
        .w-\[800px\] { width: 800px; max-width: 100%; margin: 0 auto; }
        
        /* Recharts fix for word */
        .recharts-wrapper { display: none; }
      </style>
    </head>
    <body>
  `;
  const footer = "</body></html>";

  const fullHtml = header + htmlContent + footer;

  // Create a Blob with the Word mime type
  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword'
  });

  // Create a download link and trigger the download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
