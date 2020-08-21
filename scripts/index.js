const { PDFDocument } = PDFLib;
const pdfjsLib = window['pdfjs-dist/build/pdf'];
// for single page test
const url = '../assets/test.pdf';
// const url = '../assets/canvas.pdf';
// for multiple page test;
// const url = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';
const MIME_TYPE = "image/png";
const QUALITY = 1.0;
const PDF_SCALE = 1;
let pageNumber = 0; // initial page
let maxPage = 0;
let drawCanvas = null;
let signature = null; // e-signature png
let readingPdf = null;
let isInitState = true; // for initial state
let previewPDF = null;
// must specifice
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';

// event positions
let prevPos = { x: 0, y: 0 };
let currentPos = { x: 0, y: 0 };

const onLoadPDFFile = async (_url) => {
    // display sign canvas
    pdfjsLib.getDocument(_url).promise
        .then((pdf) => {
            readingPdf = pdf;
            // get max page num;
            maxPage = pdf.numPages;
            // display numpage
            document.querySelector('#max_page').innerHTML = maxPage;
            document.querySelector('#current_page_number').innerHTML = pageNumber + 1;
            onRenderPDFPage(readingPdf, pageNumber);
        }).catch((err) => {
            console.log(err);
        });
    // load pdf stuff
    const pdfBytes = await fetch(_url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc;
}

const onRenderPDFPage = (_pdf, _pageNumber) => {
    let num = _pageNumber + 1;
    _pdf.getPage(num).then((page) => {
        console.log('Page loaded');
        // get original size with scale
        const viewport = page.getViewport({ scale: PDF_SCALE });
        if (isInitState) {
            isInitState = false;
            // set space for position absolute
            const container = document.querySelector('.canvas-container');
            const spacer = document.createElement('div');
            spacer.style.height = viewport.height + 'px';
            container.appendChild(spacer);
        }

        // Prepare canvas using PDF page dimensions
        const displayPDF = document.querySelector('.first-layer');
        const context = displayPDF.getContext('2d');
        displayPDF.height = viewport.height;
        displayPDF.width = viewport.width;
        drawCanvas.width = viewport.width;
        drawCanvas.height = viewport.height;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);
        renderTask.promise.then(() => {
            console.log('Page rendered');
        });

    });
}

const onPageChanged = (isNext) => {
    if (isNext) {
        if (pageNumber !== (maxPage - 1)) {
            pageNumber += 1;
        }
    } else {
        if (pageNumber !== 0) {
            pageNumber -= 1;
        }
    }
    document.querySelector('#current_page_number').innerHTML = pageNumber + 1;
    onRenderPDFPage(readingPdf, pageNumber);
}

const onAddCanvasListener = (canvas, ctx) => {
    // line style
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
    // event capture
    canvas.addEventListener('mousemove', (e) => {
        setInitPosition(e, canvas);
    });

    canvas.addEventListener('touchmove', e => {
        event = e.changedTouches[0];
        setInitPosition(event, canvas);
    });

    canvas.addEventListener('mousedown', (e) => {
        canvas.addEventListener('mousemove', onPaint);
    });

    canvas.addEventListener('mouseup', (e) => {
        canvas.removeEventListener('mousemove', onPaint);
    });

    canvas.addEventListener('mouseleave', (e) => {
        canvas.removeEventListener('mousemove', onPaint);
    })

    canvas.addEventListener('touchstart', (e) => {
        event = e.changedTouches[0];
        setInitPosition(event, canvas);
        canvas.addEventListener('touchmove', onPaint);
    });

    canvas.addEventListener('touchend', () => {
        canvas.removeEventListener('touchmove', onPaint);
    });


    const onPaint = () => {
        ctx.beginPath();
        ctx.moveTo(currentPos.x, currentPos.y);
        ctx.lineTo(prevPos.x, prevPos.y);
        ctx.closePath();
        ctx.stroke();
    };
}

const setInitPosition = (e, canvas) => {
    currentPos.x = prevPos.x;
    currentPos.y = prevPos.y;

    prevPos.x = e.pageX - canvas.offsetLeft;
    prevPos.y = e.pageY - canvas.offsetTop;
}

const createActionButton = () => {
    const saveBtn = document.createElement('button');
    const enableSignBtn = document.createElement('button');
    const loadMetaDataBtn = document.createElement('button');
    enableSignBtn.innerHTML = 'toggle sign action';
    saveBtn.innerHTML = 'save pdf';
    loadMetaDataBtn.innerHTML = ' load pdf meta data';
    const body = document.body;
    body.appendChild(saveBtn);
    body.appendChild(enableSignBtn);
    body.appendChild(loadMetaDataBtn);
}

const onPreviewPDF = async (_pdfDoc) => {
    const pdfDataUri = await _pdfDoc.saveAsBase64({ dataUri: true });
    const iframe = document.querySelector('#frame_pdf');
    iframe.setAttribute('src', pdfDataUri);
}

const onInitCanvas = () => {
    drawCanvas = document.querySelector('.second-layer');
    const drawContext = drawCanvas.getContext('2d');
    onAddCanvasListener(drawCanvas, drawContext);
}

const onGetMetaData = async (_pdfDoc) => {
    return {
        title: _pdfDoc.getTitle(),
        author: _pdfDoc.getAuthor(),
        subject: _pdfDoc.getSubject(),
        creator: _pdfDoc.getCreator(),
        keywords: _pdfDoc.getKeywords(),
        producer: _pdfDoc.getProducer(),
        creation_date: _pdfDoc.getCreationDate(),
        modification_date: _pdfDoc.getModificationDate()
    }
}

const onSetMetaData = async (_pdfDoc, _metaData) => {
    _pdfDoc.setTitle(_metaData.title)
    _pdfDoc.setAuthor(_metaData.author)
    _pdfDoc.setSubject(_metaData.subject)
    _pdfDoc.setKeywords(_metaData.keywords)
    _pdfDoc.setProducer(_metaData.producer)
    _pdfDoc.setCreator(_metaData.creator)
    _pdfDoc.setCreationDate(new Date(_metaData.creation_date))
    _pdfDoc.setModificationDate(new Date(_metaData.modification_date))
    const pdfBytes = await _pdfDoc.save();
    return pdfBytes;
    // for doc if need to do stuff
    // const pdfBytes = await _pdfDoc.save();
    // const pdfDoc = await PDFDocument.load(pdfBytes);
    // return pdfDoc;
}

const onSavePDF = (_pdfBytes) => {
    // use download js library
    download(_pdfBytes, "test.pdf", "application/pdf");
}

const onSaveSignature = async (_pdfDoc) => {
    signature = drawCanvas.toDataURL(MIME_TYPE);
    const pages = _pdfDoc.getPages();
    const page = pages[pageNumber];
    const pngImage = await _pdfDoc.embedPng(signature);
    const pngDims = pngImage.scale(PDF_SCALE);
    const options = {
        x: 0,
        y: 0,
        width: pngDims.width,
        height: pngDims.height
    }
    // embed signature to pdf
    page.drawImage(pngImage, options);
    // save signature to pdf
    // const pdfBytes = await _pdfDoc.save();
    // return pdfBytes;
    // for doc if need to do stuff
    const pdfBytes = await _pdfDoc.save();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc;
}

const onInit = () => {
    onInitCanvas();
    onLoadPDFFile(url).then(res => {
        previewPDF = res;
        onGetMetaData(res).then((metaData) => {
            console.log(metaData);
        });
    });
    // add save btn event
    document.querySelector('#save_sign').addEventListener('click', () => {
        onSaveSignature(previewPDF).then(savingPdf => {
            previewPDF = savingPdf;
        });
    });
    // add preview btn event
    document.querySelector('#preview').addEventListener('click', () => {
        onPreviewPDF(previewPDF).then(() => {
            console.log('preview rendered!');
        });
    })
    // createActionButton();
}