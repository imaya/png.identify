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
 * require 'png.js'
 *   :( https://github.com/devongovett/png.js ).
 */

(function(global, globalName, document) {
global[globalName] = PngIdentify;

/**
 * @constructor
 */
function PngIdentify(png, cssPrefix) {
  this.png = png;
  this.cssPrefix = cssPrefix;
  this.blockInfo = [];

  // extends png.js and zlib.js
  this.extendsPNG();
  this.extendsInflate();
}

/**
 * check PNG signature.
 * @param {!(Array|Uint8Array)} data png data.
 * @return {boolean} png file: true / else: false.
 */
PngIdentify.isPNG = function(data) {
  var i, l;

  for (i = 0, l = PngIdentify.Signature.length; i < l; i++) {
    if (data[i] !== PngIdentify.Signature[i]) {
      return false;
    }
  }

  return true;
};

/**
 * Extends png.js object
 */
PngIdentify.prototype.extendsPNG = function() {
  var png = this.png;

  // getFilters
  if (png['getFilters'] === undefined) {
    png.getFilters = function(data) {
      var filter,
          length,
          rowFilters = [],
          pos, row,
          scanlineLength;

      if (data == null) {
        data = this.imgData;
      }
      if (data.length === 0) {
        return [];
      }

      data = (new FlateStream(data)).getBytes();
      scanlineLength = (this.pixelBitlength / 8) * this.width;
      length = data.length;

      for (pos = 0, row = 0; pos < length; pos += scanlineLength) {
        rowFilters[row++] = data[pos++];
      }

      this.filters = rowFilters;

      return rowFilters;
    };
  }

  // getChunkInfo
  if (png['getChunkInfo'] === undefined) {
    png.getChunkInfo = function() {
      var result = [], chunkSize, section, pos, crc32;

      this.pos = 8;

      while (true) {
        // chunk position
        pos = this.pos;

        // chunk size
        chunkSize = this.readUInt32() >>> 0;

        // chunk type
        section = (function() {
          var section = [];
          for (i = 0; i < 4; i++) {
            section.push(String.fromCharCode(this.data[this.pos++]));
          }
          return section;
        }).call(this).join('');

        // chunk data
        this.pos += chunkSize;

        // crc32
        crc32 = this.readUInt32() >>> 0;

        result.push({
          type: section,
          size: chunkSize,
          crc32: crc32,
          position: pos
        });

        if (section === 'IEND') {
          break;
        }
      }

      return result;
    }
  }
};

/**
 * Extends FlateStream object.
 */
PngIdentify.prototype.extendsInflate = function() {
  var that = this;

  //
  // CAUTION: this method replace original readBlock method !!
  //
  FlateStream.pngIdentify = this; // current PngIdentify object only
  if (FlateStream.prototype.readBlock__ === undefined) {
    FlateStream.prototype.readBlock__ = FlateStream.prototype.readBlock;
    FlateStream.prototype.readBlock = function() {
      var currentPos = this.bytesPos,
          currentBufLen = this.bufferLength;

      // call original method
      this.readBlock__();

      FlateStream.pngIdentify.handleFlateStreamReadBlock({
        plain: this.bufferLength - currentBufLen,
        compressed: this.bytesPos - currentPos
      });
    };
  }
};

/**
 * readBlock callback function
 * @param {!{plain: number, compressed: <number>}} obj block information.
 */
PngIdentify.prototype.handleFlateStreamReadBlock = function(obj) {
  this.blockInfo.push(obj);
};

/**
 * PNG Signature
 * @const {!Array.<number>}
 */
PngIdentify.Signature = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * 基本となる 5 種類のフィルタ
 * @enum {number}
 */
PngIdentify.BasicFilterType = {
  UNKNOWN: -Infinity,
  NONE: 0,
  SUB: 1,
  UP: 2,
  AVERAGE: 3,
  PAETH: 4,
  MIXED: -1
};

/**
 * 圧縮フラグ
 * @enum {number}
 */
PngIdentify.CompressionFlag = {
  UNCOMPRESSED: 0,
  COMPRESSED: 1
};

/**
 * 圧縮方法
 * 現在は Deflate 圧縮のみ定義されている
 * @enum {number}
 */
PngIdentify.CompressionMethod = {
  DEFLATE: 0
};

/**
 * 色空間の定義
 * 1 ビット目(0x01)が立っていればパレット使用,
 * 2 ビット目(0x02)が立っていればカラー,
 * 3 ビット目(0x04)が立っていればαチャンネル付き
 * @enum {number}
 */
PngIdentify.ColourType = {
  GRAYSCALE: 0,
  TRUECOLOR: 2,
  INDEXED_COLOR: 3,
  GRAYSCALE_WITH_ALPHA: 4,
  TRUECOLOR_WITH_ALPHA: 6
};

/**
 * フィルタ方法
 * 現在は 0 の基本 5 種類のフィルタのみ定義
 * @enum {number}
 */
PngIdentify.FilterMethod = {
  BASIC: 0
};


/**
 * インタレース方法
 * @enum {number}
 */
PngIdentify.InterlaceMethod = {
  NONE: 0,
  ADAM7: 1
};

/**
 * Rendering intent for Standard RGB colour space
 * @enum {number}
 */
PngIdentify.RenderingIntent = {
  PERCEPTUAL: 0,
  RELATIVE: 1,
  SATURATION: 2,
  ABSOLUTE: 3
};

/**
 * Unit Specifier for Physical pixel dimensions
 * @enum {number}
 */
PngIdentify.UnitSpecifier = {
  UNKNOWN: 0,
  METRE: 1
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
  this.key = key;
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
  var result = [],
      rc = PngIdentify.Resource,
      keys, i, l;

  if (className === undefined) {
    className = 'resulttable';
  }

  // option value
  if (typeof(opt_param) === 'object' && opt_param !== null) {
    keys = Object.keys(opt_param);

    for (i = 0, l = keys.length; i < l; i++) {
      result.push(new KeyValue(keys[i], opt_param[keys[i]]));
    }
  }

  // image header
  result.push(
    new KeyValue(
      'Image Header',
      createTableFromKeyValueArray_([
        new KeyValue('Width', this.png.width),
        new KeyValue('Height', this.png.height),
        new KeyValue('BitDepth', this.png.bits),
        new KeyValue('ColourType', rc.ColourType[this.png.colorType]),
        new KeyValue('CompressionMethod',
          rc.CompressionMethod[this.png.compressionMethod]),
        new KeyValue('FilterMethod', rc.FilterMethod[this.png.filterMethod]),
        new KeyValue('InterlaceMethod',
          rc.InterlaceMethod[this.png.interlaceMethod])
      ], cssPrefix, 'ihdr')
    )
  );

  // chunk information
  this.updateChunkInfo();
  result.push(
    new KeyValue('Chunks', this.createChunkInfo_(cssPrefix, 'chunks'))
  );

  // palette
  if (this.png.palette.length > 0) {
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
  if (this.filterMode === PngIdentify.BasicFilterType.MIXED) {
    // filter count
    result.push(
      new KeyValue('Filter Count', this.createFilterCount_(cssPrefix))
    );

    // filter value
    result.push(
      new KeyValue(
        'Filters',
        createTableFromByteArray_(this.filters, cssPrefix)
      )
    );
  }

  // decompression information
  if (this.blockInfo.length > 0) {
    result.push(
      new KeyValue('ZLIB Blocks', this.createBlockInfo_(cssPrefix, 'blocks'))
    );
  }

  // append
  element.appendChild(
    createTableFromKeyValueArray_(result, cssPrefix, className)
  );
};

/**
 * update chunk information
 */
PngIdentify.prototype.updateChunkInfo = function() {
  var png = this.png;

  this.chunks = png.getChunkInfo();
};

/**
 * update filter information
 */
PngIdentify.prototype.updateFilterInfo = function() {
  var png = this.png,
      filters, filterCount,
      prevFilter, filterMode = PngIdentify.BasicFilterType.UNKNOWN;

  // get filter information
  filters = png.getFilters();
  this.filters = filters;

  // filter counting
  filterCount = [];
  for (i = 0, l = filters.length; i < l; i++) {
    // detect mixed
    if (i === 0) {
      prevFilter = filters[i];
    }
    if (prevFilter !== filters[i]) {
      filterMode = PngIdentify.BasicFilterType.MIXED;
    }
    prevFilter = filters[i];

    // counting
    filterCount[filters[i]] = (filterCount[filters[i]] >>> 0) + 1;
  }

  // filter mode
  this.filterMode = filterMode;
  if (filterMode !== PngIdentify.BasicFilterType.MIXED && filters.length > 0) {
    this.filterMode = filters[0];
  }

  // filter count
  delete this.filterCount;
  if (filterMode === PngIdentify.BasicFilterType.MIXED) {
    this.filterCount = filterCount;
  }
};

/**
 * update pixel information (optional).
 */
PngIdentify.prototype.updatePixelInfo = function() {
  this.blockInfo = [];
  this.pixels = this.png.decodePixels();
};


/**
 * create palette table.
 * @param {string=} cssPrefix css class name prefix.
 * @param {string=} className css class name.
 * @return {!Element} table element.
 * @private
 */
PngIdentify.prototype.createPalette_ = function(cssPrefix, className) {
  var palette = this.png.decodePalette(),
      keyValueArray = [],
      i, l,
      color, sample;

  if (className === undefined) {
    className = 'plte';
  }

  for (i = 0, l = palette.length; i < l; i++) {
    color = palette[i];
    sample = 'rgb(' + color.slice(0, 3).join(', ') + ')';
    sample =
      '<span style="padding-left:1em;background-color:' + sample + ';">' +
      '&nbsp;' +
      '</span>';
    keyValueArray.push(
      new KeyValue(
        i,
        [sample, 'rgba(' + color.join(', ') + ')'].join(' ')
      )
    );
  }

  return createTableFromKeyValueArray_(keyValueArray, cssPrefix, className);
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

  if (className === undefined) {
    className = 'chunkinfo';
  }

  for (i = 0, l = chunks.length; i < l; i++) {
    chunk = chunks[i];
    tmp.push(
      new KeyValue(chunk.type, createTableFromKeyValueArray_([
        new KeyValue('Size: ', chunk.size + ' Byte'),
        new KeyValue('Offset: ', chunk.position),
        new KeyValue('CRC32: ', uint32ToHexString(chunk.crc32))
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

  if (className === undefined) { className = 'filtercount'; }

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
      block,
      labels = ['Index', 'Plain', 'Compressed', 'Ratio'],
      i, l, j, m,
      plainTotal = 0, compressedTotal = 0;

  if (className === undefined) { className = 'blocks'; }

  // table
  table = document.createElement('table');
  table.className = makeCssClassName_([cssPrefix, className]);

  // head
  head = document.createElement('thead');
  table.appendChild(head);
  row = document.createElement('tr');
  head.appendChild(row);
  for (i = 0, l = labels.length; i < l; i++) {
    col = document.createElement('th');
    row.appendChild(col);
    col.textContent = labels[i];
  }

  // row
  function appendRow(rowData) {
    var i, l;

    row = document.createElement('tr');
    body.appendChild(row);

    for (i = 0, l = rowData.length; i < l; i++) {
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
  for (i = 0, l = this.blockInfo.length; i < l; i++) {
    block = this.blockInfo[i];
    ratio = (((block.compressed / block.plain) * 10000 + 0.5) >>> 0) / 100;
    tmp = [i, block.plain, block.compressed, ratio + ' %'];

    plainTotal += block.plain;
    compressedTotal += block.compressed;

    appendRow(tmp);
  }

  ratio = (((compressedTotal / plainTotal) * 10000 + 0.5) >>> 0) / 100;
  appendRow(['Total', plainTotal, compressedTotal, ratio + ' %']);

  return table;
};

/**
 * create KeyValue viewer table
 * @param {!Object} object object.
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

  if (className === undefined) { className = 'keyvaluetable'; }

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
 * @return {!Element} table element.
 * @private
 */
function createTableFromByteArray_(array, cssPrefix, className) {
  var table = document.createElement('table'),
      head = document.createElement('thead'),
      body = document.createElement('tbody'),
      row, col, x, pos,
      hex = '0123456689ABCDEF';

  if (className === undefined) { className = 'hextable'; }

  // table
  table.className = makeCssClassName_([cssPrefix, className]);
  table.appendChild(head);
  table.appendChild(body);

  // head
  row = document.createElement('tr');
  col = document.createElement('td');
  col.textContent = 'Address';
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
function reverseKeyValue_(object, eachFunc) {
  var newObject = {}, keys = Object.keys(object), i, l;

  for (i = 0, l = keys.length; i < l; i++) {
    newObject[object[keys[i]]] = keys[i];
  }

  return newObject;
}

/**
 * make CSS class name.
 * @param {!Array} array source array.
 * @return {!string} CSS class name.
 * @private
 */
function makeCssClassName_(array) {
  var words = [], i, l;

  for (i = 0, l = array.length; i < l; i++) {
    if (array[i] === undefined) {
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
  var hex = '0123456689ABCDEF';

  return hex[uint32 >>> 28 & 0x0F] + hex[uint32 >>> 24 & 0x0F] +
         hex[uint32 >>> 20 & 0x0F] + hex[uint32 >>> 16 & 0x0F] +
         hex[uint32 >>> 12 & 0x0F] + hex[uint32 >>> 8 & 0x0F] +
         hex[uint32 >>> 4 & 0x0F] + hex[uint32 >>> 0 & 0x0F];
}


})(this, 'PngIdentify', document);

/* vim:set expandtab ts=2 sw=2: */
