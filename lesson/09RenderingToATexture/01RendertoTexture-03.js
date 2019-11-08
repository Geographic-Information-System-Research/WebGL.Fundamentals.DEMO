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
    var colorMultLocation = gl.getUniformLocation(program, "u_colorMult");

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

    {
        // fill texture with 3x2 pixels
        const level = 0;
        const internalFormat = gl.LUMINANCE;
        const width = 3;
        const height = 2;
        const border = 0;
        const format = gl.LUMINANCE;
        const type = gl.UNSIGNED_BYTE;
        const data = new Uint8Array([
          128, 64, 128,
            0, 192, 0,
        ]);
        const alignment = 1;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
                      format, type, data);

        // set the filtering so we don't need mips and it's not filtered
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Create a texture to render to
    const targetTextureWidth = 256;
    const targetTextureHeight = 256;
    const targetTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);

    {
        // define size and format of level 0
        const level = 0;
        const internalFormat = gl.RGBA;
        const border = 0;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        const data = null;
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                      targetTextureWidth, targetTextureHeight, border,
                      format, type, data);

        // set the filtering so we don't need mips
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Create and bind the framebuffer
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, level);

    // create a depth renderbuffer
    // 创建一个深度缓冲
    const depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

    /*
    需要特别注意的是WebGL只允许三种附件组合形式。 根据规范 一定能正确运行的附件组合是：
    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture
    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture + DEPTH_ATTACHMENT = DEPTH_COMPONENT16 renderbuffer
    COLOR_ATTACHMENT0 = RGBA/UNSIGNED_BYTE texture + DEPTH_STENCIL_ATTACHMENT = DEPTH_STENCIL renderbuffer
    */
    // make a depth buffer and the same size as the targetTexture
    // 设置深度缓冲的大小和targetTexture相同
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, targetTextureWidth, targetTextureHeight);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    var fieldOfViewRadians = degToRad(60);
    var modelXRotationRadians = degToRad(0);
    var modelYRotationRadians = degToRad(0);

    // Get the starting time.
    var then = 0;

    requestAnimationFrame(drawScene);

    function drawCube(aspect) {
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

        for (let x = -1; x <= 1; ++x) {
            var matrix = m4.translate(viewProjectionMatrix, x * .9, 0, 0);
            matrix = m4.xRotate(matrix, modelXRotationRadians * x);
            matrix = m4.yRotate(matrix, modelYRotationRadians * x);

            // Set the matrix.
            gl.uniformMatrix4fv(matrixLocation, false, matrix);

            // Tell the shader to use texture unit 0 for u_texture
            gl.uniform1i(textureLocation, 0);

            //
            const c = x * .5 + .5;
            gl.uniform4fv(colorMultLocation, [c, 1, 1 - c, 1]);

            // Draw the geometry.
            gl.drawArrays(gl.TRIANGLES, 0, 6 * 6);
        }
    }

    // Draw the scene.
    function drawScene(time) {
        // convert to seconds
        time *= 0.001;
        // Subtract the previous time from the current time
        var deltaTime = time - then;
        // Remember the current time for the next frame.
        then = time;

        // Animate the rotation
        modelYRotationRadians += -0.7 * deltaTime;
        modelXRotationRadians += -0.4 * deltaTime;

        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        {
            // render to our targetTexture by binding the framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

            // render cube with our 3x2 texture
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // Tell WebGL how to convert from clip space to pixels
            gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

            // Clear the attachment(s).
            gl.clearColor(.5, .7, 1, 1);   // clear to blue
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            const aspect = targetTextureWidth / targetTextureHeight;
            drawCube(aspect);
        }

        {
            // render to the canvas
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            // render the cube with the texture we just rendered to
            gl.bindTexture(gl.TEXTURE_2D, targetTexture);

            // Tell WebGL how to convert from clip space to pixels
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            // Clear the canvas AND the depth buffer.
            gl.clearColor(1, 1, 1, 1);   // clear to white
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


            const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
            drawCube(aspect);
        }

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

// Fill the buffer with texture coordinates the cube.
function setTexcoords(gl) {
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
          [
            0, 0,
            0, 1,
            1, 0,
            0, 1,
            1, 1,
            1, 0,

            0, 0,
            0, 1,
            1, 0,
            1, 0,
            0, 1,
            1, 1,

            0, 0,
            0, 1,
            1, 0,
            0, 1,
            1, 1,
            1, 0,

            0, 0,
            0, 1,
            1, 0,
            1, 0,
            0, 1,
            1, 1,

            0, 0,
            0, 1,
            1, 0,
            0, 1,
            1, 1,
            1, 0,

            0, 0,
            0, 1,
            1, 0,
            1, 0,
            0, 1,
            1, 1,

          ]),
        gl.STATIC_DRAW);
}

main();
