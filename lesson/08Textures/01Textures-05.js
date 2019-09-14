﻿"use strict";

var zDepth = 50;

function main() {
    // Get A WebGL context
    var canvas = document.getElementById("canvas", { antialias: false });
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

    // Create a texture with different colored mips
    var mipTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mipTexture);
    var c = document.createElement("canvas");
    var ctx = c.getContext("2d");
    var mips = [
      { size: 64, color: "rgb(128,0,255)", },
      { size: 32, color: "rgb(0,0,255)", },
      { size: 16, color: "rgb(255,0,0)", },
      { size: 8, color: "rgb(255,255,0)", },
      { size: 4, color: "rgb(0,255,0)", },
      { size: 2, color: "rgb(0,255,255)", },
      { size: 1, color: "rgb(255,0,255)", },
    ];
    mips.forEach(function (s, level) {
        var size = s.size;
        c.width = size;
        c.height = size;
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = s.color;
        ctx.fillRect(0, 0, size / 2, size / 2);
        ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
        gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    });

    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 255, 255]));
    // Asynchronously load an image
    var image = new Image();
    image.src = "../data/img/mip-low-res-example.png"; //https://webglfundamentals.org/webgl/resources/mip-low-res-example.png
    image.addEventListener('load', function () {
        // Now that the image has loaded make copy it to the texture.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

        // Check if the image is a power of 2 in both dimensions.
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            // Yes, it's a power of 2. Generate mips.
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            // No, it's not a power of 2. Turn of mips and set wrapping to clamp to edge
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        drawScene();
    });

    var textures = [
      texture,
      mipTexture,
    ];
    var textureIndex = 0;

    document.body.addEventListener('click', function () {
        textureIndex = (textureIndex + 1) % textures.length;
        drawScene();
    });

    function isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }

    function radToDeg(r) {
        return r * 180 / Math.PI;
    }

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    var fieldOfViewRadians = degToRad(60);

    drawScene();

    // Draw the scene.
    function drawScene() {
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the framebuffer texture.
        gl.clearColor(0, 0, 0, 1);
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
        var zNear = 1;
        var zFar = 2000;
        var projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

        var cameraPosition = [0, 0, 2];
        var up = [0, 1, 0];
        var target = [0, 0, 0];

        // Compute the camera's matrix using look at.
        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        var settings = [
          { x: -1, y: 1, zRot: 0, magFilter: gl.NEAREST, minFilter: gl.NEAREST, },
          { x: 0, y: 1, zRot: 0, magFilter: gl.LINEAR, minFilter: gl.LINEAR, },
          { x: 1, y: 1, zRot: 0, magFilter: gl.LINEAR, minFilter: gl.NEAREST_MIPMAP_NEAREST, },
          { x: -1, y: -1, zRot: 1, magFilter: gl.LINEAR, minFilter: gl.LINEAR_MIPMAP_NEAREST, },
          { x: 0, y: -1, zRot: 1, magFilter: gl.LINEAR, minFilter: gl.NEAREST_MIPMAP_LINEAR, },
          { x: 1, y: -1, zRot: 1, magFilter: gl.LINEAR, minFilter: gl.LINEAR_MIPMAP_LINEAR, },
        ];
        var xSpacing = 1.2;
        var ySpacing = 0.7;
        settings.forEach(function (s) {
            gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex]);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, s.minFilter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, s.magFilter);

            var matrix = m4.translate(viewProjectionMatrix, s.x * xSpacing, s.y * ySpacing, -zDepth * 0.5);
            matrix = m4.zRotate(matrix, s.zRot * Math.PI);
            matrix = m4.scale(matrix, 1, 1, zDepth);

            // Set the matrix.
            gl.uniformMatrix4fv(matrixLocation, false, matrix);

            // Tell the shader to use texture unit 0 for u_texture
            gl.uniform1i(textureLocation, 0);

            // Draw the geometry.
            gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);
        });
    }
}

// Fill the buffer with the values that define a plane.
function setGeometry(gl) {
    var positions = new Float32Array(
      [
      -0.5, 0.5, -0.5,
       0.5, 0.5, -0.5,
      -0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
       0.5, 0.5, -0.5,
       0.5, 0.5, 0.5,

      ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

// Fill the buffer with texture coordinates for a plane.
function setTexcoords(gl) {
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
          [
          0, 0,
          1, 0,
          0, zDepth,
          0, zDepth,
          1, 0,
          1, zDepth,

          ]),
        gl.STATIC_DRAW);
}

main();
