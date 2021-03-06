﻿"use strict";

function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    // setup GLSL program
    var program = webglUtils.createProgramFromScripts(gl, ["3d-vertex-shader", "3d-fragment-shader"]);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");
    var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

    // lookup uniforms
    var matrixLocation = gl.getUniformLocation(program, "u_matrix");
    var textureLocation = gl.getUniformLocation(program, "u_texture");

    // Create a buffer for positions
    var positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put the positions in the buffer
    setGeometry(gl);

    // provide texture coordinates for the rectangle.
    var texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    // Set Texcoords.
    setTexcoords(gl);

    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // fill texture with 3x2 pixels
    const level = 0;
    const internalFormat = gl.LUMINANCE;
    const width = 2;
    const height = 2;
    const border = 0;
    const format = gl.LUMINANCE;//单通道 1字节
    const type = gl.UNSIGNED_BYTE;
    //const data = new Uint8Array([
    //  128, 64, 128,
    //    0, 192, 0,
    //]);
    const data = new Uint8Array([
     128, 64, 
       0, 192,
    ]);
    const alignment = 1;
    /*
    WebGL: INVALID_OPERATION: texImage2D: ArrayBufferView not big enough for request
    结果是WebGL中有一种首次创建OpenGL后的模糊设定， 
    计算机有时在数据为某些特定大小时速度会快一些， 
    例如一次拷贝2，4 或 8 个字节比一次拷贝 1 个字节要快， 
    WebGL默认使用 4 字节长度，所以它期望每一行数据是多个 4 字节数据（最后一行除外）。

    我们之前的数据每行只有 3 个字节，总共为 6 字节， 
    但是 WebGL 试图在第一行获取 4 个字节，第二行获取 3 个字节， 总共 7 个字节，所以会出现这样的报错。
    */
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);//告诉WebGL一次处理 1 个字节
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
                  format, type, data);

    // set the filtering so we don't need mips
    // 设置筛选器，我们不需要使用贴图所以就不用筛选器了
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);//三类：REPEAT  CLAMP_TO_EDGE  MIRRORED_REPEAT
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    var fieldOfViewRadians = degToRad(60);
    var modelXRotationRadians = degToRad(0);
    var modelYRotationRadians = degToRad(0);

    // Get the starting time.
    var then = 0;

    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene(time) {
        // convert to seconds
        time *= 0.001;
        // Subtract the previous time from the current time
        var deltaTime = time - then;
        // Remember the current time for the next frame.
        then = time;

        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Animate the rotation
        modelYRotationRadians += -0.7 * deltaTime;
        modelXRotationRadians += -0.4 * deltaTime;

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);

        // Turn on the position attribute
        gl.enableVertexAttribArray(positionLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 3;          // 3 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            positionLocation, size, type, normalize, stride, offset);

        // Turn on the teccord attribute
        gl.enableVertexAttribArray(texcoordLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            texcoordLocation, size, type, normalize, stride, offset);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

        var cameraPosition = [0, 0, 2];
        var up = [0, 1, 0];
        var target = [0, 0, 0];

        // Compute the camera's matrix using look at.
        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        var matrix = m4.xRotate(viewProjectionMatrix, modelXRotationRadians);
        matrix = m4.yRotate(matrix, modelYRotationRadians);

        // Set the matrix.
        gl.uniformMatrix4fv(matrixLocation, false, matrix);

        // Tell the shader to use texture unit 0 for u_texture
        gl.uniform1i(textureLocation, 0);

        // Draw the geometry.
        gl.drawArrays(gl.TRIANGLES, 0, 6 * 6);

        requestAnimationFrame(drawScene);
    }
}

// Fill the buffer with the values that define a cube.
function setGeometry(gl) {
    var positions = new Float32Array(
      [
      -0.5, -0.5, -0.5,
      -0.5, 0.5, -0.5,
       0.5, -0.5, -0.5,
      -0.5, 0.5, -0.5,
       0.5, 0.5, -0.5,
       0.5, -0.5, -0.5,

      -0.5, -0.5, 0.5,
       0.5, -0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
       0.5, -0.5, 0.5,
       0.5, 0.5, 0.5,

      -0.5, 0.5, -0.5,
      -0.5, 0.5, 0.5,
       0.5, 0.5, -0.5,
      -0.5, 0.5, 0.5,
       0.5, 0.5, 0.5,
       0.5, 0.5, -0.5,

      -0.5, -0.5, -0.5,
       0.5, -0.5, -0.5,
      -0.5, -0.5, 0.5,
      -0.5, -0.5, 0.5,
       0.5, -0.5, -0.5,
       0.5, -0.5, 0.5,

      -0.5, -0.5, -0.5,
      -0.5, -0.5, 0.5,
      -0.5, 0.5, -0.5,
      -0.5, -0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, 0.5, -0.5,

       0.5, -0.5, -0.5,
       0.5, 0.5, -0.5,
       0.5, -0.5, 0.5,
       0.5, -0.5, 0.5,
       0.5, 0.5, -0.5,
       0.5, 0.5, 0.5,

      ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}


function setTexcoords(gl) {
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
          [
            0, 0,
            0, 4,
            4, 0,
            0, 4,
            4, 4,
            4, 0,

            0, 0,
            0, 4,
            4, 0,
            4, 0,
            0, 4,
            4, 4,

            0, 0,
            0, 4,
            4, 0,
            0, 4,
            4, 4,
            4, 0,

            0, 0,
            0, 4,
            4, 0,
            4, 0,
            0, 4,
            4, 4,

            0, 0,
            0, 4,
            4, 0,
            0, 4,
            4, 4,
            4, 0,

            0, 0,
            0, 4,
            4, 0,
            4, 0,
            0, 4,
            4, 4,

          ]),
        gl.STATIC_DRAW);
}
main();
