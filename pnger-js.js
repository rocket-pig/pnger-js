// uses crc32 'CRC32' from https://github.com/SheetJS/js-crc32/blob/master/crc32.js
// and zlib 'pako' from https://github.com/nodeca/pako/blob/master/dist/pako.js

//The first eight bytes of a PNG file always contain the following (decimal) values:
var signature = new Uint8Array([137,80,78,71,13,10,26,10]);

//Each chunk consists of four parts:

//Length
//A 4-byte unsigned integer giving the number of bytes in the chunk's data field.
//The length counts only the data field, not itself, the chunk type code, or the CRC
function returnPackedLength(length) {
    var lengthBytes = new Uint8Array(4);
    lengthBytes[0] = length >> 24;
    lengthBytes[1] = length >> 16;
    lengthBytes[2] = length >> 8;
    lengthBytes[3] = length;
    return lengthBytes;
}

//Chunk Data
//The data bytes appropriate to the chunk type.
//Chunk Type
//A 4-byte chunk type array.
function returnPackedChunkType(str) {
  return new Uint8Array(str.split('')
    .map(c => c.charCodeAt(0)));
}

//All integers that require more than one byte must be in network byte order
//returns a NBO/BE 4-byte array for given number:
function returnPackedInt(num) {
  var numBytes = new Uint8Array(4);
  numBytes[0] = num >> 24;
  numBytes[1] = num >> 16;
  numBytes[2] = num >> 8;
  numBytes[3] = num;
  return numBytes;
}

//http://www.libpng.org/pub/png/spec/1.2/PNG-Chunks.html#C.IHDR
//IHDR:
function returnPackedIHDR(width, height, bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod) {
  var packedData = new Uint8Array(25);
  var length = returnPackedInt(13);
  packedData.set(length,0);
  var IHDR = returnPackedChunkType('IHDR');
  packedData.set(IHDR,4);
  var width = returnPackedInt(width);
  packedData.set(width,8);
  var height = returnPackedInt(height);
  packedData.set(height,12);
  packedData[16] = bitDepth;
  packedData[17] = colorType;
  packedData[18] = compressionMethod;
  packedData[19] = filterMethod;
  packedData[20] = interlaceMethod;
  crc = CRC32.buf(packedData.slice(4, 21));
  var crcBytes = returnPackedInt(crc);
  packedData.set(crcBytes,21);
  return packedData;
}

//IDAT
//The image data.
function returnPackedIDAT(data) {
    //IDAT data is compressed with zlib.
    compressedData = pako.deflate(data);
    var newData = new Uint8Array(compressedData.length+12);
    var length = returnPackedInt(compressedData.length);
    newData.set(length,0);
    var IDAT = returnPackedChunkType('IDAT');
    newData.set(IDAT,4);
    newData.set(compressedData, 8);
    crc = CRC32.buf(IDAT);
    crc = CRC32.buf(newData.slice(4, compressedData.length+8));
    var crcBytes = returnPackedInt(crc);
    newData.set(crcBytes, compressedData.length+8);
    return newData;
}

// IEND
//The final chunk.
function returnPackedIEND() {
    var packedData = new Uint8Array(12);
    var length = 0;
    packedData.set(returnPackedInt(length),0);
    var IEND = returnPackedChunkType('IEND');
    packedData.set(IEND,4);
    var crcBytes = returnPackedInt(2923585666);
    packedData.set(crcBytes,8)
    return packedData;
}

///////////// end of png packing spec //////////////////////

//initalize a uint8array to all 255
function initializeUint8Array(length) {
    var arr = new Uint8Array(length);
    for (var i = 0; i < length; i++) {
        arr[i] = 255;
    }
    return arr;
}

function random_rgb_array(width, height) {
    actual_length_needed = (width * height*3)-(width+height+1);
    var rgb_array = initializeUint8Array(width*height*3);
    grr = [];
    rowcount = 0;
    for (i=0; i<actual_length_needed; i++) {
        grr.push(0)
        for (var j = 0; j < width; j++) {
            i++;
            r = Math.floor(Math.random() * 254) + 1; grr.push(r); i++;
            g =Math.floor(Math.random() * 254) + 1; grr.push(g); i++;
            b = Math.floor(Math.random() * 254) + 1; grr.push(b);
            }
        rowcount++;
    }
  rgb_array.set(grr, 0);
  return rgb_array;
}


/// the main grind. returns a fully-formed png file in bytes
function create_png(secret_message) {
    var [rgb_array, width, height] = string_to_rgb(secret_message);
    var data = new Uint8Array(rgb_array);
    var IHDR = returnPackedIHDR(width, height, 8, 2, 0, 0, 0);
    var IDAT = returnPackedIDAT(data);
    var IEND = returnPackedIEND();
    var png = new Uint8Array(signature.length + IHDR.length + IDAT.length + IEND.length);
    png.set(signature,0);
    png.set(IHDR, signature.length);
    png.set(IDAT, signature.length + IHDR.length);
    png.set(IEND, signature.length + IHDR.length + IDAT.length);
    return png;
}

/////////////// show's over /////////////////////////////////////////////////
/////////////////////////// other helper functions //////////////////////////

// function to convert a string to an array of ints
strtoab = str =>
  new Array(str.split('')
    .map(c => c.charCodeAt(0)))[0];

// function to convert an array of ints to a string
abtostr = ab =>
  ab.reduce((p, c) =>
  p + String.fromCharCode(c), '');


//print distance between zeros in an array
function print_distance(arr) {
  var count = 0;
  var last_zero = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] == 0) {
      count++;
      console.log(i - last_zero);
      last_zero = i;
    }

  }
  console.log('distance: '+count);
}

//reads IHDR from uint8array and returns bitdepth, color type, compression method, filter method, interlace method, wigth, height.
// the following function incorporates it.
function read_IHDR(array) {
  var ihdr = {};
  ihdr.width = array[0] << 24 | array[1] << 16 | array[2] << 8 | array[3];
  ihdr.height = array[4] << 24 | array[5] << 16 | array[6] << 8 | array[7];
  ihdr.bitdepth = array[8];
  ihdr.colortype = array[9];
  ihdr.compression = array[10];
  ihdr.filter = array[11];
  ihdr.interlace = array[12];
  return ihdr;
  }

//converts array of BIG-endian bytes to int
function bytes_to_int(arr) {
  return ((arr[0] & 0xFF) << 24) | ((arr[1] & 0xFF) << 16)
           | ((arr[2] & 0xFF) << 8) | (arr[3] & 0xFF);
}

// parse a PNG printing it's deets.
//a better version of previous parser.
function parse_array_better(arr) {
    // create dict for response
    var response = {}; var IDAT_count = 0;
    // crawl the array one byte at a time
    for (var i = 0; i < arr.length; i++) {
        // if we find an IHDR, read it
        if (arr[i] == 73 && arr[i+1] == 72 && arr[i+2] == 68 && arr[i+3] == 82) {
            console.log('found IHDR at '+i+' in '+arr.length+': '+arr.slice(i,i+4));
            console.log(read_IHDR(arr.slice(i+4,i+18)));
            response.IHDR = read_IHDR(arr.slice(i+4,i+18));
            }
        // if we find an IDAT, read it
        if (arr[i] == 73 && arr[i+1] == 68 && arr[i+2] == 65 && arr[i+3] == 84) {
            IDAT_count++;
            console.log('found IDAT at '+i+' in '+arr.length+': '+arr.slice(i,i+4));
            // read the length of the chunk
            var thislength = bytes_to_int(arr.slice(i-4,i));
            // read the crc at end of chunk (4 bytes is the length of the chunk type)
            var thiscrc = bytes_to_int(arr.slice(i+thislength+4,i+thislength+8))
            //compute the crc of the chunk
            var crc = CRC32.buf(arr.slice(i,i+thislength+4));
            // add crc to response
            response['IDAT_'+IDAT_count] = {'length': thislength, 'crc in file': thiscrc, 'crc computed': crc};
            // if the crc matches, add the chunk to the response
            if (crc == thiscrc) {
                response['IDAT_'+IDAT_count]['data'] = arr.slice(i,i+thislength+4);
                }
            // complain if the crc doesn't match
            else {
                console.log('crc mismatch in chunk at '+i+' in '+arr.length+': '+thiscrc+' does not match '+crc);
                }
            }
        if (arr[i] == 73 && arr[i+1] == 68 && arr[i+2] == 69 && arr[i+3] == 78) {
            console.log('found IEND at '+i+' in '+arr.length+': '+arr.slice(i,i+4));
            console.log(read_IHDR(arr.slice(i+4,i+18)));
            }
        }
        return response;
    }


// takes string as input and converts to RGB array
function string_to_rgb(string_data) {
    string_data = strtoab(string_data);
    width = Math.ceil(Math.sqrt(string_data.length/3));
    width = Math.ceil(width/3)*3
    height = width;
    actual_length_needed = (width * height*3)+(height);
    console.log(width+"*"+height+"="+width*height+"*3="+width*height*3);
    console.log('string length: '+string_data.length);
    var rgb_array = new Uint8Array(actual_length_needed);
    for (var i = 0; i < rgb_array.length; i++) {
        rgb_array[i] = 0;
    }
    build = [];
    rowcount = 0;
    for (i=0; i<string_data.length; i++) {
        build.push(0) //filter value added to start of each row.
        for (var j = 0; j < width; j++) {
            r = string_data[i]; build.push(r); i++;
            g = string_data[i]; build.push(g); i++;
            b = string_data[i]; build.push(b); i++;
            } rowcount++; }
  console.log('rowcount: '+rowcount);
  console.log('adding '+build.length+' values to '+rgb_array.length);
  rgb_array.set(build, 0);
  return [rgb_array, width, height];
}
