/**
 * png file viewer in JavaScript
 *
 * The MIT License
 *
 * Copyright (c) 2012 imaya
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * @fileoverview png file viewer in JavaScript.
 */

goog.provide('PngIdentify');

goog.require('ZlibStat.Inflate');
goog.require('Zlib.CRC32');

goog.scope(function() {

/**
 * @param {!(Array.<number>|Uint8Array)} input input buffer.
 * @param {string} cssPrefix css prefix string.
 * @constructor
 */
PngIdentify = function(input, cssPrefix) {
  /** @type {!(Array.<number>|Uint8Array)} */
  this.input = input;
  /** @type {(string|undefined)} */
  this.cssPrefix = cssPrefix;
  /** @type {!Array.<Object>} */
  this.blockInfo;
  /** @type {!ZlibStat.Inflate} */
  this.zlibstat;
  /** @type {!(Array.<number>|Uint8Array)} */
  this.imageData;
  /** @type {!(Array.<number>|Uint8Array)} */
  this.idat; // joined idat chunks
  /** @type {number} */
  this.width;
  /** @type {number} */
  this.height;
  /** @type {number} */
  this.bitDepth;
  /** @type {number} */
  this.colourType;
  /** @type {number} */
  this.compressionMethod;
  /** @type {number} */
  this.filterMethod;
  /** @type {number} */
  this.interlaceMethod;
  /** @type {!(Array.<number>|Uint8Array)} */
  this.histogram;
};

/**
 * check PNG signature.
 * @param {!(Array|Uint8Array)} data png data.
 * @return {boolean} png file: true / else: false.
 */
PngIdentify.isPNG = function(data) {
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = PngIdentify.Signature.length; i < il; ++i) {
    if (data[i] !== PngIdentify.Signature[i]) {
      return false;
    }
  }

  return true;
};

/**
 * get pixel line filters.
 */
PngIdentify.prototype.getFilters = function(data) {
  /** @type {number} */
  var length;
  /** @type {Array.<number>} */
  var rowFilters = [];
  /** @type {number} */
  var pos;
  /** @type {number} */
  var row;
  /** @type {number} */
  var scanlineLength;

  if (data.length === 0) {
    return [];
  }

  scanlineLength = ((function (colourType) {
    switch (colourType) {
      case PngIdentify.ColourType['GRAYSCALE']:
      case PngIdentify.ColourType['INDEXED_COLOR']:
        return 1;
      case PngIdentify.ColourType['GRAYSCALE_WITH_ALPHA']:
        return 2;
      case PngIdentify.ColourType['TRUECOLOR']:
        return 3;
      case PngIdentify.ColourType['TRUECOLOR_WITH_ALPHA']:
        return 4;
    }
  })(this.colourType) * this.bitDepth * this.width + 7) / 8 | 0;

  length = data.length;

  for (pos = 0, row = 0; pos < length; pos += scanlineLength) {
    rowFilters[row++] = data[pos++];
  }

  this.filters = rowFilters;

  return rowFilters;
};

/**
 * parse png chunks
 */
PngIdentify.prototype.parse = function(data) {
  /** @type {Array.<Object>} */
  var chunk = this.chunks = [];
  /** @type {number} */
  var chunkSize;
  /** @type {string} chunk type. */
  var section;
  /** @type {number} */
  var pos;
  /** @type {number} */
  var crc32a;
  /** @type {number} */
  var crc32b;
  /** @type {!(Array.<number>|Uint8Array)} */
  var idat;
  /** @type {number} */
  var idatLength = 0;
  /** @type {!(Array.<number>|Uint8Array)} */
  var idatChunk;
  /** @type {Array.<!(Array.<number>|Uint8Array)>} */
  var idatChunks = [];
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;
  /** @type {number} */
  var j;
  /** @type {number} */
  var jl;
  /** @type {Array.<Array.<number>>} */
  var palette = this.palette = [];
  /** @type {!(Array.<number>|Uint8Array)} */
  var histogram;
  /** @type {number} */
  var histogramTotal;

  if (!PngIdentify.isPNG(data)) {
    throw new Error('invalid png file');
  }

  this.pos = 8;

  while (true) {
    // chunk position
    pos = this.pos;

    // chunk size
    chunkSize = (
        (data[this.pos++] << 24) | (data[this.pos++] << 16) |
        (data[this.pos++] <<  8) | (data[this.pos++]      )
    ) >>> 0;

    // chunk type
    section = (function() {
      var section = [];
      for (i = 0; i < 4; i++) {
        section.push(String.fromCharCode(data[this.pos++]));
      }
      return section.join('');
    }).call(this);

    // crc32-a
    crc32a = Zlib.CRC32.calc(
      USE_TYPEDARRAY ?
      data.subarray(this.pos - 4, this.pos + chunkSize) :
      data.slice(this.pos - 4, this.pos + chunkSize)
    );

    // idat
    switch (section) {
      case 'IHDR':
        this.width = (
            (data[this.pos++] << 24) | (data[this.pos++] << 16) |
            (data[this.pos++] <<  8) | (data[this.pos++]      )
        ) >>> 0;
        this.height = (
            (data[this.pos++] << 24) | (data[this.pos++] << 16) |
            (data[this.pos++] <<  8) | (data[this.pos++]      )
        ) >>> 0;
        this.bitDepth = data[this.pos++];
        this.colourType = data[this.pos++];
        this.compressionMethod = data[this.pos++];
        this.filterMethod = data[this.pos++];
        this.interlaceMethod = data[this.pos++];
        break;
      case 'IDAT':
        idatChunks.push(
            USE_TYPEDARRAY ? data.subarray(this.pos, this.pos += chunkSize)
                           : data.slice(this.pos, this.pos += chunkSize)
        );
        idatLength += chunkSize;
        break;
      case 'PLTE':
        for (i = 0, j = 0; i < chunkSize; i += 3) {
          palette[j++] =
            [data[this.pos++], data[this.pos++], data[this.pos++], 255];
        }
        break;
      case 'tRNS':
        if (this.colourType === PngIdentify.ColourType['INDEXED_COLOR']) {
          for (i = 0, il = chunkSize; i < il; ++i) {
            palette[i][3] = data[this.pos++];
          }
        }
        break;
      default:
        this.pos += chunkSize;
        break;
    }

    // crc32-b
    crc32b = (
      (data[this.pos++] << 24) | (data[this.pos++] << 16) |
      (data[this.pos++] <<  8) | (data[this.pos++]      )
    ) >>> 0;

    chunk.push({
      'type': section,
      'size': chunkSize,
      'crc32': [
        uint32ToHexString(crc32b),
        'verify: ' + (crc32a === crc32b)
      ].join(' / '),
      'position': pos
    });

    if (section === 'IEND') {
      break;
    }
  }

  // join idat
  idat = this.idat = new (USE_TYPEDARRAY ? Uint8Array : Array)(idatLength);
  for (pos = 0, i = 0, il = idatChunks.length; i < il; ++i) {
    idatChunk = idatChunks[i];
    for (j = 0, jl = idatChunk.length; j < jl; ++j) {
      idat[pos++] = idatChunk[j]
    }
  }

  // decompress image data
  this.imageData = (this.zlibstat = new ZlibStat.Inflate(idat)).decompress();
  this.blockInfo = this.zlibstat.getBlocks();

  // color histogram
  /*
  TODO: bit depth とフィルタを考慮したデコードを行っていないため凍結
  if (this.colourType === PngIdentify.ColourType.INDEXED_COLOR) {
    histogramTotal = 0;
    idat = this.imageData;
    histogram = this.histogram =
      new (USE_TYPEDARRAY ? Uint32Array : Array)(palette.length);
    if (USE_TYPEDARRAY) {
      for (i = 0, il = idat.length; i < il; ++i) {
        ++histogram[idat[i]];
        ++histogramTotal;
      }
    } else {
      for (i = 0, il = idat.length; i < il; ++i) {
        histogram[idat[i]] = (histogram[idat[i]] | 0) + 1;
        ++histogramTotal;
      }
    }
  }
  */

  return chunk;
};

/**
 * PNG Signature
 * @const
 * @type {!Array.<number>}
 */
PngIdentify.Signature = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * 基本となる 5 種類のフィルタ
 * @enum {number}
 */
PngIdentify.BasicFilterType = {
  'UNKNOWN': -Infinity,
  'NONE': 0,
  'SUB': 1,
  'UP': 2,
  'AVERAGE': 3,
  'PAETH': 4,
  'MIXED': -1
};

/**
 * 圧縮フラグ
 * @enum {number}
 */
PngIdentify.CompressionFlag = {
  'UNCOMPRESSED': 0,
  'COMPRESSED': 1
};

/**
 * 圧縮方法
 * 現在は Deflate 圧縮のみ定義されている
 * @enum {number}
 */
PngIdentify.CompressionMethod = {
  'DEFLATE': 0
};

/**
 * 色空間の定義
 * 1 ビット目(0x01)が立っていればパレット使用,
 * 2 ビット目(0x02)が立っていればカラー,
 * 3 ビット目(0x04)が立っていればαチャンネル付き
 * @enum {number}
 */
PngIdentify.ColourType = {
  'GRAYSCALE': 0,
  'TRUECOLOR': 2,
  'INDEXED_COLOR': 3,
  'GRAYSCALE_WITH_ALPHA': 4,
  'TRUECOLOR_WITH_ALPHA': 6
};

/**
 * フィルタ方法
 * 現在は 0 の基本 5 種類のフィルタのみ定義
 * @enum {number}
 */
PngIdentify.FilterMethod = {
  'BASIC': 0
};

/**
 * インタレース方法
 * @enum {number}
 */
PngIdentify.InterlaceMethod = {
  'NONE': 0,
  'ADAM7': 1
};

/**
 * Rendering intent for Standard RGB colour space
 * @enum {number}
 */
PngIdentify.RenderingIntent = {
  'PERCEPTUAL': 0,
  'RELATIVE': 1,
  'SATURATION': 2,
  'ABSOLUTE': 3
};

/**
 * Unit Specifier for Physical pixel dimensions
 * @enum {number}
 */
PngIdentify.UnitSpecifier = {
  'UNKNOWN': 0,
  'METRE': 1
};

/**
 * @enum {Object}
 */
PngIdentify.Resource = {
  BasicFilterType: enumToResource(PngIdentify.BasicFilterType),
  CompressionFlag: enumToResource(PngIdentify.CompressionFlag),
  CompressionMethod: enumToResource(PngIdentify.CompressionMethod),
  ColourType: enumToResource(PngIdentify.ColourType),
  FilterMethod: enumToResource(PngIdentify.FilterMethod),
  InterlaceMethod: enumToResource(PngIdentify.InterlaceMethod),
  RenderingIntent: enumToResource(PngIdentify.RenderingIntent),
  UnitSpecifier: enumToResource(PngIdentify.UnitSpecifier)
};

/**
 * Key Value Object (private class)
 * @param {*} key object key.
 * @param {*} value object value.
 * @constructor
 */
function KeyValue(key, value) {
  /** @type {*} */
  this.key = key;
  /** @type {*} */
  this.value = value;
}

/**
 * append result to target element
 * @param {!Element} element target element.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @param {Object=} opt_param option view (key-value pair).
 */
PngIdentify.prototype.appendToElement =
function(element, cssPrefix, className, opt_param) {
  /** @type {Array.<KeyValue>} */
  var result = [];
  /** @type {*} */
  var rc = PngIdentify.Resource;
  /** @type {Array.<string>} */
  var keys;
  /** @type {number} */
  var i;
  /** @type {number} */
  var l;

  if (className === void 0) {
    className = 'resulttable';
  }

  // option value
  if (typeof(opt_param) === 'object' && opt_param !== null) {
    keys = Object.keys(opt_param);

    for (i = 0, l = keys.length; i < l; i++) {
      result.push(new KeyValue(keys[i], opt_param[keys[i]]));
    }
  }

  // parse
  this.parse(this.input);

  // image header
  result.push(
    new KeyValue(
      'Image Header',
      createTableFromKeyValueArray_([
        new KeyValue('Width', this.width),
        new KeyValue('Height', this.height),
        new KeyValue('BitDepth', this.bitDepth),
        new KeyValue('ColourType', rc.ColourType[this.colourType] +
          ' (' + this.colourType + ')'),
        new KeyValue('CompressionMethod',
          rc.CompressionMethod[this.compressionMethod] + 
          ' (' + this.compressionMethod + ')'),
        new KeyValue('FilterMethod', rc.FilterMethod[this.filterMethod] +
          ' (' + this.filterMethod + ')'),
        new KeyValue('InterlaceMethod',
          rc.InterlaceMethod[this.interlaceMethod] +
          ' (' + this.interlaceMethod + ')')
      ], cssPrefix, 'ihdr')
    )
  );

  // chunk information
  result.push(
    new KeyValue('Chunks', this.createChunkInfo_(cssPrefix, 'chunks'))
  );

  // palette
  if (this.palette.length > 0) {
    result.push(
      new KeyValue('Palette', this.createPalette_(cssPrefix, 'plte'))
    );
  }

  // filter
  this.updateFilterInfo();
  result.push(
    new KeyValue(
      'Filter Mode',
      rc.BasicFilterType[this.filterMode] +
      (this.filterMode >= 0 ? ' (' + this.filterMode + ')' : '')
    )
  );

  // filter: mixed
  if (this.filterMode === PngIdentify.BasicFilterType['MIXED']) {
    // filter count
    result.push(
      new KeyValue('Filter Count', this.createFilterCount_(cssPrefix))
    );

    // filter value
    result.push(
      new KeyValue(
        'Filters',
        createTableFromByteArray_(this.filters, cssPrefix, void 0, 'Line')
      )
    );
  }

  // decompression information
  if (this.blockInfo.length > 0) {
    result.push(
      new KeyValue('ZLIB Blocks', this.createBlockInfo_(cssPrefix, 'blocks'))
    );
  }

  // huffman
  if (this.blockInfo.length > 0) {
    result.push(
      new KeyValue('ZLIB Huffman Table', this.createBlockInfoHuffman_(cssPrefix, 'huffman'))
    );
  }

  // append
  element.appendChild(
    createTableFromKeyValueArray_(result, cssPrefix, className)
  );
};

/**
 * update filter information
 */
PngIdentify.prototype.updateFilterInfo = function() {
  var filters, filterCount,
      prevFilter, filterMode = PngIdentify.BasicFilterType['UNKNOWN'],
      i, il;

  // get filter information
  filters = this.getFilters(this.imageData);
  this.filters = filters;

  // filter counting
  filterCount = [];
  for (i = 0, il = filters.length; i < il; i++) {
    // detect mixed
    if (i === 0) {
      prevFilter = filters[i];
    }
    if (prevFilter !== filters[i]) {
      filterMode = PngIdentify.BasicFilterType['MIXED'];
    }
    prevFilter = filters[i];

    // counting
    filterCount[filters[i]] = (filterCount[filters[i]] >>> 0) + 1;
  }

  // filter mode
  this.filterMode = filterMode;
  if (filterMode !== PngIdentify.BasicFilterType['MIXED'] && filters.length > 0) {
    this.filterMode = filters[0];
  }

  // filter count
  delete this.filterCount;
  if (filterMode === PngIdentify.BasicFilterType['MIXED']) {
    this.filterCount = filterCount;
  }
};

/**
 * create palette table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createPalette_ = function(cssPrefix, className) {
  var table, head, body, row, col;
  var palette = this.palette,
      keyValueArray = [],
      i, il,
      color, sample;
  var labels = ['Index', 'Color', 'Count', 'Ratio'];

  if (className === void 0) {
    className = 'plte';
  }

  // table
  table = document.createElement('table');
  table.className = makeCssClassName_([cssPrefix, className]);

  // head
  head = document.createElement('thead');
  table.appendChild(head);
  row = document.createElement('tr');
  head.appendChild(row);
  for (i = 0, il = labels.length; i < il; i++) {
    col = document.createElement('th');
    row.appendChild(col);
    col.textContent = labels[i];
  }

  // body
  body = document.createElement('tbody');
  table.appendChild(body);
  for (i = 0, il = palette.length; i < il; i++) {
    color = palette[i];
    sample = 'rgb(' + color.slice(0, 3).join(', ') + ')';
    sample =
      '<span style="padding-left:1em;background-color:' + sample + ';">' +
      '&nbsp;' +
      '</span>';
    appendRow([
      i,
      [
        sample,
        'rgba(' + color.join(', ') + ')'
      ].join(' ')
      /*,
      this.histogram[i],
      ((this.histogram[i] / (this.width * this.height) * 10000 + 0.5 | 0) / 100) + '%'
      */
    ]);
  }

  // row
  function appendRow(rowData) {
    var i, il;

    row = document.createElement('tr');
    body.appendChild(row);

    for (i = 0, il = rowData.length; i < il; i++) {
      col = document.createElement('td');
      row.appendChild(col);
      col.innerHTML = rowData[i];
      if (i !== 1) {
        col.className = [
          col.className,
          makeCssClassName_([cssPrefix, 'number'])
        ].join(' ');
      }
    }
  }

  return table;
};

/**
 * create filter count table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createChunkInfo_ = function(cssPrefix, className) {
  var chunks = this.chunks, chunk, i, l, tmp = [];

  if (className === void 0) {
    className = 'chunkinfo';
  }

  for (i = 0, l = chunks.length; i < l; i++) {
    chunk = chunks[i];
    tmp.push(
      new KeyValue(chunk.type, createTableFromKeyValueArray_([
        new KeyValue('Size: ', chunk['size'] + ' Byte'),
        new KeyValue('Offset: ', chunk['position']),
        new KeyValue('CRC32: ', chunk['crc32'])
      ], cssPrefix, 'chunkinfo'))
    );
  }

  return createTableFromKeyValueArray_(tmp, cssPrefix, className);
};

/**
 * create filter count table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 */
PngIdentify.prototype.createFilterCount_ = function(cssPrefix, className) {
  var table, head, body, row, col,
      rc = PngIdentify.Resource,
      i, l, j, m,
      tmp, count, ratio;

  if (className === void 0) { className = 'filtercount'; }

  // table
  table = document.createElement('table');
  table.className = makeCssClassName_([cssPrefix, className]);

  // head
  head = document.createElement('thead');
  table.appendChild(head);
  row = document.createElement('tr');
  head.appendChild(row);
  for (i = 0; i < 3; i++) {
    col = document.createElement('th');
    row.appendChild(col);
    col.textContent = ['Filter', 'Count', 'Ratio'][i];
  }

  // body
  body = document.createElement('tbody');
  table.appendChild(body);
  for (i = 0, l = this.filterCount.length; i < l; i++) {
    count = this.filterCount[i] >>> 0;
    ratio = ((count / this.filters.length * 10000 + 0.5) >>> 0) / 100;
    tmp = [i + '. ' + rc.BasicFilterType[i], count, ratio + ' %'];

    if (count === 0) {
      continue;
    }

    row = document.createElement('tr');
    body.appendChild(row);

    for (j = 0, m = tmp.length; j < m; j++) {
      col = document.createElement('td');
      row.appendChild(col);
      col.textContent = tmp[j];
      if (j > 0) {
        col.className = [
          col.className,
          makeCssClassName_([cssPrefix, 'number'])
        ].join(' ');
      }
    }
  }

  return table;
};

/**
 * create zlib block information table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createBlockInfo_ = function(cssPrefix, className) {
  var table, head, body, row, col,
      block, ratio, type, literal, lzssLength, lzssCount,
      labels = ['Index', 'Type', 'Plain', 'Compressed', 'Ratio', 'Literal', 'LZSS-Count', 'LZSS-Total', 'LZSS-Avg'],
      types = ['Plain', 'Fixed', 'Dynamic'],
      i, il, j, jl,
      plainTotal = 0, compressedTotal = 0, literalTotal = 0, lzssCountTotal = 0, lzssLengthTotal = 0;

  if (className === void 0) { className = 'blocks'; }

  // table
  table = document.createElement('table');
  table.className = makeCssClassName_([cssPrefix, className]);

  // head
  head = document.createElement('thead');
  table.appendChild(head);
  row = document.createElement('tr');
  head.appendChild(row);
  for (i = 0, il = labels.length; i < il; i++) {
    col = document.createElement('th');
    row.appendChild(col);
    col.textContent = labels[i];
  }

  // row
  function appendRow(rowData) {
    var i, il;

    row = document.createElement('tr');
    body.appendChild(row);

    for (i = 0, il = rowData.length; i < il; i++) {
      col = document.createElement('td');
      row.appendChild(col);
      col.textContent = rowData[i];
      col.className = [
        col.className,
        makeCssClassName_([cssPrefix, 'number'])
      ].join(' ');
    }
  }

  // body
  body = document.createElement('tbody');
  table.appendChild(body);
  for (i = 0, il = this.blockInfo.length; i < il; i++) {
    block = this.blockInfo[i];
    type = block['type'];
    ratio = (block['compressed'].length / block['plain'].length * 10000 + 0.5 | 0) / 100;

    plainTotal += block['plain'].length;
    compressedTotal += block['compressed'].length;

    // plain block
    if (type === 0) {
      literal = 0;
      lzssCount = 0;
      lzssLength = 0;
    // compressed block
    } else {
      // literal
      for (literal = 0, j = 0; j <= 255 ; ++j) {
        literal += block['litlenCount'][j];
      }

      // lzss
      lzssCount = block['lzssCode'].length;
      for (lzssLength = 0, j = 0; j < lzssCount; ++j) {
        lzssLength += block['lzssCode'][j].length;
      }

      // total
      literalTotal += literal;
      lzssLengthTotal += lzssLength;
      lzssCountTotal += lzssCount;
    }

    appendRow([
      /* index          */ i,
      /* block type     */ types[type],
      /* plain size     */ block['plain'].length,
      /* compress       */ block['compressed'].length,
      /* compress-ratio */ ratio + ' %',
      /* literal        */ literal,
      /* lzss-count     */ lzssCount,
      /* lzss-length    */ lzssLength,
      /* lzss-average   */ (lzssLength / lzssCount * 100 + 0.5 | 0) / 100
    ]);
  }

  ratio = (((compressedTotal / plainTotal) * 10000 + 0.5) | 0) / 100;
  appendRow([
    /* index          */ 'Total',
    /* block type     */ '-',
    /* plain size     */ plainTotal,
    /* compress       */ compressedTotal,
    /* compress-ratio */ ratio + ' %',
    /* literal        */ literalTotal,
    /* lzss-count     */ lzssCountTotal,
    /* lzss-length    */ lzssLengthTotal,
    /* lzss-average   */ (lzssLengthTotal / lzssCountTotal * 100 + 0.5 | 0) / 100
  ]);

  return table;
};


/**
 * create zlib block information table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createBlockInfoHuffman_ = function(cssPrefix, className) {
  var array = [], block, i, il, huffman, code;

  for (i = 0, il = this.blockInfo.length; i < il; i++) {
    block = this.blockInfo[i];

    if (block.type === 0) {
      continue;
    }

    array.push({
      key: i,
      value: this.createBlockHuffmanTable_(
        block,
        cssPrefix,
        'huffman-table'
      )
    });
  }

  return createTableFromKeyValueArray_(array, cssPrefix, className);
};

/**
 * create zlib huffman table.
 * @param {Object} block zlib block object.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createBlockHuffmanTable_ = function(block, cssPrefix, className) {
  var table, head, body, row, col,
      huffmanTable,
      codeCount, codeCountTotal = 0,
      bitLength, bitLengthTotal = 0,
      labels = ['Value', 'Code', 'Count', 'Total Bits'],
      i, il;

  if (className === void 0) { className = 'huffman-table'; }

  // table
  table = document.createElement('table');
  table.className = makeCssClassName_([cssPrefix, className]);

  // head
  head = document.createElement('thead');
  table.appendChild(head);
  row = document.createElement('tr');
  head.appendChild(row);
  for (i = 0, il = labels.length; i < il; i++) {
    col = document.createElement('th');
    row.appendChild(col);
    col.textContent = labels[i];
  }

  // row
  function appendRow(rowData) {
    var i, il;

    row = document.createElement('tr');
    body.appendChild(row);

    for (i = 0, il = rowData.length; i < il; i++) {
      col = document.createElement('td');
      row.appendChild(col);
      col.textContent = rowData[i];
      col.className = [
        col.className,
        makeCssClassName_([cssPrefix, 'number'])
      ].join(' ');
    }
  }

  // body
  body = document.createElement('tbody');
  table.appendChild(body);

  for (i = 0, il = block['litlenHuffmanTable'].length; i < il; i++) {
    huffmanTable = block['litlenHuffmanTable'][i];

    codeCount = block['litlenCount'][huffmanTable[0]];
    bitLength = codeCount * huffmanTable[2];

    codeCountTotal += codeCount;
    bitLengthTotal += bitLength;

    appendRow([
      /* decoded value */ huffmanTable[0],
      /* huffman code  */ bitstring(huffmanTable[1], huffmanTable[2]),
      /* code count    */ codeCount,
      /* bit length    */ bitLength
    ]);
  }

  appendRow([
    /* decoded value */ 'Total',
    /* huffman code  */ '-',
    /* code count    */ codeCountTotal,
    /* bit length    */ bitLengthTotal
  ]);

  function bitstring(num, len) {
    return (
      '0000000000000000' + num.toString(2)
    ).split('').reverse().slice(0, len).join('');
  }

  return table;
};

/**
 * create KeyValue viewer table
 * @param {!Array.<{key: *, value: *}>} array key-value object array.
 * @param {string=} cssPrefix css class prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
function createTableFromKeyValueArray_(array, cssPrefix, className) {
  var table = document.createElement('table'),
      body = document.createElement('tbody'),
      row, col,
      i, l,
      key, value;

  if (className === void 0) { className = 'keyvaluetable'; }

  // table
  table.className = makeCssClassName_([cssPrefix, className]);
  table.appendChild(body);

  // append key-value rows
  for (i = 0, l = array.length; i < l; i++) {
    key = array[i].key;
    value = array[i].value;

    row = document.createElement('tr');
    body.appendChild(row);

    // key
    col = document.createElement('th');
    row.appendChild(col);
    col.className = makeCssClassName_([cssPrefix, className, 'key']);
    col.textContent = key;

    // value
    col = document.createElement('td');
    row.appendChild(col);
    col.className = makeCssClassName_([cssPrefix, className, 'value']);

    if (value instanceof Element) {
      col.appendChild(value);
    } else {
      col.innerHTML = value;
    }
  }

  return table;
}

/**
 * create hex viewer table
 * @param {!Array} array byte array.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @param {string=} label table label.
 * @return {!Element} table element.
 * @private
 */
function createTableFromByteArray_(array, cssPrefix, className, label) {
  var table = document.createElement('table'),
      head = document.createElement('thead'),
      body = document.createElement('tbody'),
      row, col, x, pos,
      hex = '0123456789ABCDEF';

  if (className === void 0) { className = 'hextable'; }

  // table
  table.className = makeCssClassName_([cssPrefix, className]);
  table.appendChild(head);
  table.appendChild(body);

  // head
  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = label || 'Address';
  row.appendChild(col);
  for (x = 0; x < 16; x++) {
    col = document.createElement('td');
    col.textContent = '+' + hex[x];
    row.appendChild(col);
  }
  head.appendChild(row);

  // body
  for (pos = 0; pos < array.length; pos++) {
    if (pos % 0x10 === 0) {
      row = document.createElement('tr');
      col = document.createElement('td');
      col.className = makeCssClassName_([cssPrefix, className, 'address']);
      col.textContent = uint32ToHexString(pos);
      row.appendChild(col);
      body.appendChild(row);
    }
    col = document.createElement('td');
    col.className = makeCssClassName_([cssPrefix, className, 'hex']);
    col.textContent +=
      hex[array[pos] >>> 4 & 0x0F] + hex[array[pos] >>> 0 & 0x0F];
    row.appendChild(col);
  }

  return table;
}

/**
 * enum to resource object.
 * @param {!Object} en enum object.
 * @return {!Object} resource object.
 */
function enumToResource(en) {
  var obj, keys, key, value, i, l;

  obj = reverseKeyValue_(en);
  keys = Object.keys(obj);

  for (i = 0, l = keys.length; i < l; i++) {
    key = keys[i];
    value = obj[key];

    obj[key] = value[0].toUpperCase().charAt(0) +
      value.toLowerCase().substr(1);
  }

  return obj;
}

/**
 * from key-value to value-key.
 * @param {!Object} object target object.
 * @return {!Object} new object.
 */
function reverseKeyValue_(object) {
  /** @type {!Object} */
  var newObject = {};
  /** @type {Array.<string>} */
  var keys = Object.keys(object);
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = keys.length; i < il; i++) {
    newObject[object[keys[i]]] = keys[i];
  }

  return newObject;
}

/**
 * make CSS class name.
 * @param {!Array.<string>} array source array.
 * @return {!string} CSS class name.
 * @private
 */
function makeCssClassName_(array) {
  /** @type {Array.<string>} */
  var words = [];
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = array.length; i < il; i++) {
    if (array[i] === void 0) {
      continue;
    }
    words.push(array[i]);
  }

  return words.join('-');
};

/**
 * unsigned 32-bit integer to hex string.
 * @param {number} uint32 unsigned 32-bit interger.
 * @return {string} hex string.
 */
function uint32ToHexString(uint32) {
  /** @type {string} */
  var hex = '0123456689ABCDEF';

  return hex[uint32 >>> 28 & 0x0F] + hex[uint32 >>> 24 & 0x0F] +
         hex[uint32 >>> 20 & 0x0F] + hex[uint32 >>> 16 & 0x0F] +
         hex[uint32 >>> 12 & 0x0F] + hex[uint32 >>> 8 & 0x0F] +
         hex[uint32 >>> 4 & 0x0F] + hex[uint32 >>> 0 & 0x0F];
}

//-----------------------------------------------------------------------------
// export
//-----------------------------------------------------------------------------
goog.exportSymbol('PngIdentify', PngIdentify);
goog.exportSymbol('PngIdentify.isPNG', PngIdentify.isPNG);
goog.exportSymbol(
  'PngIdentify.prototype.appendToElement',
  PngIdentify.prototype.appendToElement
);


});
/* vim:set expandtab ts=2 sw=2: */
