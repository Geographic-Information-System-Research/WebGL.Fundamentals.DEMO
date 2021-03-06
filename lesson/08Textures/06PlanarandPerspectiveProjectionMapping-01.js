﻿'use strict';

function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        return;
    }

    // setup GLSL program
    // compiles shader, links program, look up locations
    const textureProgramInfo = webglUtils.createProgramInfo(gl, ['3d-vertex-shader', '3d-fragment-shader']);

    const sphereBufferInfo = primitives.createSphereBufferInfo(
        gl,
        1,  // radius
        12, // subdivisions around
        6,  // subdivisions down
    );
    const planeBufferInfo = primitives.createPlaneBufferInfo(
        gl,
        20,  // width
        20,  // height
        1,   // subdivisions across
        1,   // subdivisions down
    );

    // make a 8x8 checkerboard texture
    const checkerboardTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, checkerboardTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,                // mip level
        gl.LUMINANCE,     // internal format
        8,                // width
        8,                // height
        0,                // border
        gl.LUMINANCE,     // format
        gl.UNSIGNED_BYTE, // type
        new Uint8Array([  // data
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        ]));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    const settings = {
        cameraX: 2.75,
        cameraY: 5,
    };
    webglLessonsUI.setupUI(document.querySelector('#ui'), settings, [
      { type: 'slider',   key: 'cameraX',    min: -10, max: 10, change: render, precision: 2, step: 0.001, },
      { type: 'slider',   key: 'cameraY',    min:   1, max: 20, change: render, precision: 2, step: 0.001, },
    ]);

    const fieldOfViewRadians = degToRad(60);

    // Uniforms for each object.
    const planeUniforms = {
        u_colorMult: [0.5, 0.5, 1, 1],  // lightblue
        u_texture: checkerboardTexture,
        u_world: m4.translation(0, 0, 0),
    };
    const sphereUniforms = {
        u_colorMult: [1, 0.5, 0.5, 1],  // pink
        u_texture: checkerboardTexture,
        u_world: m4.translation(2, 3, 4),
    };

    function drawScene(projectionMatrix, cameraMatrix) {
        // Make a view matrix from the camera matrix.
        const viewMatrix = m4.inverse(cameraMatrix);

        gl.useProgram(textureProgramInfo.program);

        // Set the uniform that both the sphere and the plane share
        webglUtils.setUniforms(textureProgramInfo, {
            u_view: viewMatrix,
            u_projection: projectionMatrix,
        });

        // ------ Draw the sphere --------

        // Setup all the needed attributes.
        webglUtils.setBuffersAndAttributes(gl, textureProgramInfo, sphereBufferInfo);

        // Set the uniforms unique to the sphere
        webglUtils.setUniforms(textureProgramInfo, sphereUniforms);

        // calls gl.drawArrays or gl.drawElements
        webglUtils.drawBufferInfo(gl, sphereBufferInfo);

        // ------ Draw the plane --------

        // Setup all the needed attributes.
        webglUtils.setBuffersAndAttributes(gl, textureProgramInfo, planeBufferInfo);

        // Set the uniforms unique to the plane
        webglUtils.setUniforms(textureProgramInfo, planeUniforms);

        // calls gl.drawArrays or gl.drawElements
        webglUtils.drawBufferInfo(gl, planeBufferInfo);
    }

    function render() {
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

        // Compute the camera's matrix using look at.
        const cameraPosition = [settings.cameraX, settings.cameraY, 7];
        const target = [0, 0, 0];//看向0 0 0
        const up = [0, 1, 0];
        const cameraMatrix = m4.lookAt(cameraPosition, target, up);

        drawScene(projectionMatrix, cameraMatrix);
    }
    render();
}

main();
