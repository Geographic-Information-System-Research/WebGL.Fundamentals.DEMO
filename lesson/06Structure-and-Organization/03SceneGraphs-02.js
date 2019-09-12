﻿"use strict";

var Node = function () {
    this.children = [];
    this.localMatrix = m4.identity();
    this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function (parent) {
    // remove us from our parent
    if (this.parent) {
        var ndx = this.parent.children.indexOf(this);
        if (ndx >= 0) {
            this.parent.children.splice(ndx, 1);
        }
    }

    // Add us to our new parent
    if (parent) {
        parent.children.push(this);
    }
    this.parent = parent;
};

Node.prototype.updateWorldMatrix = function (parentWorldMatrix) {
    if (parentWorldMatrix) {
        // a matrix was passed in so do the math
        m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
    } else {
        // no matrix was passed in so just copy local to world
        m4.copy(this.localMatrix, this.worldMatrix);
    }

    // now process all the children
    var worldMatrix = this.worldMatrix;
    this.children.forEach(function (child) {
        child.updateWorldMatrix(worldMatrix);
    });
};



function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    var createFlattenedVertices = function (gl, vertices) {
        var last;
        return webglUtils.createBufferInfoFromArrays(
            gl,
            primitives.makeRandomVertexColors(
                primitives.deindexVertices(vertices),
                {
                    vertsPerColor: 1,
                    rand: function (ndx, channel) {
                        if (channel === 0) {
                            last = 128 + Math.random() * 128 | 0;
                        }
                        return channel < 3 ? last : 255;
                    }
                })
          );
    };

    var sphereBufferInfo = createFlattenedVertices(gl, primitives.createSphereVertices(10, 12, 6));

    // setup GLSL program
    var programInfo = webglUtils.createProgramInfo(gl, ["3d-vertex-shader", "3d-fragment-shader"]);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function emod(x, n) {
        return x >= 0 ? (x % n) : ((n - (-x % n)) % n);
    }


    var cameraAngleRadians = degToRad(0);
    var fieldOfViewRadians = degToRad(60);
    var cameraHeight = 50;

    var objectsToDraw = [];
    var objects = [];

    // Let's make all the nodes
    var sunNode = new Node();
    sunNode.localMatrix = m4.translation(0, 0, 0);  // sun a the center
    sunNode.drawInfo = {
        uniforms: {
            u_colorOffset: [0.6, 0.6, 0, 1], // yellow
            u_colorMult: [0.4, 0.4, 0, 1],
        },
        programInfo: programInfo,
        bufferInfo: sphereBufferInfo,
    };

    var earthNode = new Node();
    earthNode.localMatrix = m4.translation(100, 0, 0);  // earth 100 units from the sun
    // 让地球变为两倍大小
    earthNode.localMatrix = m4.scale(earthNode.localMatrix, 2, 2, 2);
    earthNode.drawInfo = {
        uniforms: {
            u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
            u_colorMult: [0.8, 0.5, 0.2, 1],
        },
        programInfo: programInfo,
        bufferInfo: sphereBufferInfo,
    };

    var moonNode = new Node();
    moonNode.localMatrix = m4.translation(20, 0, 0);  // moon 20 units from the earth
    moonNode.drawInfo = {
        uniforms: {
            u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
            u_colorMult: [0.1, 0.1, 0.1, 1],
        },
        programInfo: programInfo,
        bufferInfo: sphereBufferInfo,
    };


    // connect the celetial objects
    moonNode.setParent(earthNode);
    earthNode.setParent(sunNode);

    var objects = [
      sunNode,
      earthNode,
      moonNode,
    ];

    var objectsToDraw = [
      sunNode.drawInfo,
      earthNode.drawInfo,
      moonNode.drawInfo,
    ];

    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene(time) {
        time *= 0.0005;

        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

        // Compute the camera's matrix using look at.
        var cameraPosition = [0, -200, 0];
        var target = [0, 0, 0];
        var up = [0, 0, 1];
        var cameraMatrix = m4.lookAt(cameraPosition, target, up);//看向中心（太阳）

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

        // update the local matrices for each object.
        m4.multiply(m4.yRotation(0.01), sunNode.localMatrix, sunNode.localMatrix);
        m4.multiply(m4.yRotation(0.01), earthNode.localMatrix, earthNode.localMatrix);
        m4.multiply(m4.yRotation(0.01), moonNode.localMatrix, moonNode.localMatrix);

        // Update all world matrices in the scene graph
        sunNode.updateWorldMatrix();

        // Compute all the matrices for rendering
        objects.forEach(function (object) {
            object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
        });

        // ------ Draw the objects --------

        var lastUsedProgramInfo = null;
        var lastUsedBufferInfo = null;

        objectsToDraw.forEach(function (object) {
            var programInfo = object.programInfo;
            var bufferInfo = object.bufferInfo;
            var bindBuffers = false;

            if (programInfo !== lastUsedProgramInfo) {
                lastUsedProgramInfo = programInfo;
                gl.useProgram(programInfo.program);

                // We have to rebind buffers when changing programs because we
                // only bind buffers the program uses. So if 2 programs use the same
                // bufferInfo but the 1st one uses only positions the when the
                // we switch to the 2nd one some of the attributes will not be on.
                bindBuffers = true;
            }

            // Setup all the needed attributes.
            if (bindBuffers || bufferInfo !== lastUsedBufferInfo) {
                lastUsedBufferInfo = bufferInfo;
                webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);
            }

            // Set the uniforms.
            webglUtils.setUniforms(programInfo, object.uniforms);

            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
        });

        requestAnimationFrame(drawScene);
    }
}

main();
