"use client";
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Wallet } from 'lucide-react'
// All positions defined in a shared coordinate system (relative to the diagram container)
// Container is ~720x360
const POSITIONS = {
    sender: {
        x: 48,
        y: 180,
        w: 96,
        h: 96,
    },
    node1: {
        x: 276,
        y: 60,
        w: 168,
        h: 56,
    },
    node2: {
        x: 276,
        y: 152,
        w: 168,
        h: 56,
    },
    node3: {
        x: 276,
        y: 244,
        w: 168,
        h: 56,
    },
    recipient: {
        x: 576,
        y: 100,
        w: 96,
        h: 96,
    },
}
// Center points for connectors
const cx = (p: typeof POSITIONS.sender) => p.x + p.w / 2
const cy = (p: typeof POSITIONS.sender) => p.y + p.h / 2
const right = (p: typeof POSITIONS.sender) => p.x + p.w
const left = (p: typeof POSITIONS.sender) => p.x
const top_ = (p: typeof POSITIONS.sender) => p.y
const bot = (p: typeof POSITIONS.sender) => p.y + p.h
const VW = 720
const VH = 360
const pctX = (v: number) => `${(v / VW) * 100}%`
const pctY = (v: number) => `${(v / VH) * 100}%`
export function PrivacyFlow() {
    const [step, setStep] = useState(-1)
    const cancelled = useRef(false)
    const runLoop = useCallback(async () => {
        while (!cancelled.current) {
            setStep(0)
            await delay(800)
            if (cancelled.current) return
            setStep(1)
            await delay(1200)
            if (cancelled.current) return
            setStep(2)
            await delay(1200)
            if (cancelled.current) return
            setStep(3)
            await delay(1200)
            if (cancelled.current) return
            setStep(4)
            await delay(1500)
            if (cancelled.current) return
            setStep(-1)
            await delay(800)
        }
    }, [])
    useEffect(() => {
        cancelled.current = false
        runLoop()
        return () => {
            cancelled.current = true
        }
    }, [runLoop])
    const isActive = (s: number) => step === s

    // Helper to determine stroke color based on active step
    const getStrokeColor = (activeStep: number, currentStep: number) => {
        // For the final step (4), we might want to keep the "success" color or just green
        return currentStep >= activeStep ? '#00FF41' : 'rgba(255,255,255,0.12)'
    }

    const getStrokeWidth = (activeStep: number, currentStep: number) => {
        return currentStep >= activeStep ? 1.5 : 1
    }

    return (
        <div className="w-full relative border border-dust-border bg-[rgba(255,255,255,0.01)] p-4 sm:p-8 flex flex-col font-mono">
            <div className="text-[10px] text-dust-muted uppercase tracking-[0.2em] mb-4">
                OVERVIEW / PRIVACY FLOW
            </div>

            {/* Diagram Container */}
            <div className="w-full overflow-x-auto">
            <div
                className="relative"
                style={{
                    aspectRatio: '720 / 360',
                    minWidth: 480,
                }}
            >
                {/* === SVG CONNECTOR LAYER === */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 720 360"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <filter id="dotGlow">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        <marker
                            id="arrowGreen"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <path
                                d="M0,0 L8,3 L0,6"
                                fill="none"
                                stroke="#00FF41"
                                strokeWidth="1"
                            />
                        </marker>
                        <marker
                            id="arrowMuted"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <path
                                d="M0,0 L8,3 L0,6"
                                fill="none"
                                stroke="rgba(255,255,255,0.2)"
                                strokeWidth="1"
                            />
                        </marker>
                        <marker
                            id="arrowActive"
                            markerWidth="8"
                            markerHeight="6"
                            refX="7"
                            refY="3"
                            orient="auto"
                        >
                            <path
                                d="M0,0 L8,3 L0,6"
                                fill="none"
                                stroke="#00FF41"
                                strokeWidth="1"
                            />
                        </marker>
                    </defs>

                    {/* Sender → Node1 (horizontal right, then up to node1) */}
                    <motion.path
                        d={`M ${right(POSITIONS.sender)} ${cy(POSITIONS.sender)} L ${left(POSITIONS.node1) - 20} ${cy(POSITIONS.sender)} L ${left(POSITIONS.node1) - 20} ${cy(POSITIONS.node1)} L ${left(POSITIONS.node1)} ${cy(POSITIONS.node1)}`}
                        fill="none"
                        initial={{ stroke: 'rgba(255,255,255,0.12)' }}
                        animate={{
                            stroke: getStrokeColor(0, step),
                            strokeWidth: getStrokeWidth(0, step),
                        }}
                        transition={{ duration: 0.3 }}
                        strokeDasharray="6 4"
                        markerEnd={step >= 0 ? "url(#arrowActive)" : "url(#arrowMuted)"}
                    />
                    {/* Label on horizontal segment */}
                    <text
                        x={(right(POSITIONS.sender) + left(POSITIONS.node1) - 20) / 2}
                        y={cy(POSITIONS.sender) - 8}
                        fill="rgba(255,255,255,0.3)"
                        fontSize="8"
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                    >
                        sends ETH / tokens
                    </text>

                    {/* Node1 → Node2 (vertical) */}
                    <motion.line
                        x1={cx(POSITIONS.node1)}
                        y1={bot(POSITIONS.node1)}
                        x2={cx(POSITIONS.node2)}
                        y2={top_(POSITIONS.node2)}
                        initial={{ stroke: 'rgba(255,255,255,0.12)' }}
                        animate={{
                            stroke: getStrokeColor(1, step),
                            strokeWidth: getStrokeWidth(1, step),
                        }}
                        transition={{ duration: 0.3 }}
                        strokeDasharray="4 4"
                        markerEnd={step >= 1 ? "url(#arrowActive)" : undefined}
                    />

                    {/* Node2 → Node3 (vertical) */}
                    <motion.line
                        x1={cx(POSITIONS.node2)}
                        y1={bot(POSITIONS.node2)}
                        x2={cx(POSITIONS.node3)}
                        y2={top_(POSITIONS.node3)}
                        initial={{ stroke: 'rgba(255,255,255,0.12)' }}
                        animate={{
                            stroke: getStrokeColor(2, step),
                            strokeWidth: getStrokeWidth(2, step),
                        }}
                        transition={{ duration: 0.3 }}
                        strokeDasharray="4 4"
                        markerEnd={step >= 2 ? "url(#arrowActive)" : undefined}
                    />

                    {/* Node3 → Recipient (fork: top path, solid green) */}
                    <motion.path
                        d={`M ${right(POSITIONS.node3)} ${cy(POSITIONS.node3)} L ${right(POSITIONS.node3) + 30} ${cy(POSITIONS.node3)} L ${left(POSITIONS.recipient)} ${cy(POSITIONS.recipient)}`}
                        fill="none"
                        initial={{ stroke: 'rgba(255,255,255,0.12)', strokeOpacity: 0.1 }}
                        animate={{
                            stroke: step >= 3 ? '#00FF41' : 'rgba(255,255,255,0.12)',
                            strokeOpacity: step >= 3 ? 1 : 0.1,
                            strokeWidth: step >= 3 ? 1.5 : 1,
                        }}
                        transition={{ duration: 0.3 }}
                        markerEnd={step >= 3 ? "url(#arrowGreen)" : undefined}
                    />
                    <text
                        x={right(POSITIONS.node3) + 60}
                        y={cy(POSITIONS.node3) - 30}
                        fill={step >= 3 ? "#00FF41" : "rgba(255,255,255,0.3)"}
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                    >
                        FUNDS ARRIVE
                    </text>

                    {/* Node3 → fade (fork: bottom path, dashed muted) */}
                    <path
                        d={`M ${right(POSITIONS.node3)} ${cy(POSITIONS.node3)} L ${right(POSITIONS.node3) + 30} ${cy(POSITIONS.node3)} L ${right(POSITIONS.node3) + 120} ${cy(POSITIONS.node3) + 50}`}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                    <text
                        x={right(POSITIONS.node3) + 100}
                        y={cy(POSITIONS.node3) + 70}
                        fill="rgba(255,255,255,0.25)"
                        fontSize="8"
                        textAnchor="middle"
                        fontFamily="JetBrains Mono"
                        textDecoration="line-through"
                    >
                        NO LINK ON-CHAIN
                    </text>
                </svg>

                {/* === HTML ELEMENT LAYER === */}

                {/* SENDER */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(POSITIONS.sender.x),
                        top: pctY(POSITIONS.sender.y),
                        width: pctX(POSITIONS.sender.w),
                        height: pctY(POSITIONS.sender.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${isActive(0) || step > 0 ? 'border-[rgba(0,255,65,0.4)] shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center transition-all duration-300`}
                    >
                        <Wallet className={`w-5 h-5 ${isActive(0) || step > 0 ? 'text-dust-green' : 'text-dust-muted'} mb-1.5`} />
                        <span className="text-[10px] tracking-wider">SENDER</span>
                    </div>
                </div>

                {/* NODE 1: Stealth Address */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(POSITIONS.node1.x),
                        top: pctY(POSITIONS.node1.y),
                        width: pctX(POSITIONS.node1.w),
                        height: pctY(POSITIONS.node1.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${isActive(1) || step > 1 ? 'border-[rgba(0,255,65,0.4)] shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center transition-all duration-300`}
                    >
                        <span className="text-[10px] font-bold">STEALTH ADDRESS</span>
                        <span className="text-[8px] text-dust-muted mt-0.5">
                            one-time via ECDH
                        </span>
                    </div>
                </div>

                {/* NODE 2: Announcement */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(POSITIONS.node2.x),
                        top: pctY(POSITIONS.node2.y),
                        width: pctX(POSITIONS.node2.w),
                        height: pctY(POSITIONS.node2.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${isActive(2) || step > 2 ? 'border-[rgba(0,255,65,0.4)] shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex items-center justify-center gap-2 transition-all duration-300`}
                    >
                        <span className="text-[10px] font-bold">ANNOUNCEMENT</span>
                        <span className="px-1 py-0.5 border border-dust-green/20 bg-dust-green/8 text-[7px] text-dust-green tracking-wider">
                            ERC-5564
                        </span>
                    </div>
                </div>

                {/* NODE 3: ZK Proof */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(POSITIONS.node3.x),
                        top: pctY(POSITIONS.node3.y),
                        width: pctX(POSITIONS.node3.w),
                        height: pctY(POSITIONS.node3.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${isActive(3) || step > 3 ? 'border-[rgba(0,255,65,0.4)] shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex items-center justify-center gap-2 transition-all duration-300`}
                    >
                        <span className="text-[10px] font-bold">ZK PROOF</span>
                        <span className="px-1 py-0.5 border border-dust-border bg-[rgba(255,255,255,0.03)] text-[7px] text-dust-muted tracking-wider">
                            GROTH16
                        </span>
                    </div>
                </div>

                {/* RECIPIENT */}
                <div
                    className="absolute"
                    style={{
                        left: pctX(POSITIONS.recipient.x),
                        top: pctY(POSITIONS.recipient.y),
                        width: pctX(POSITIONS.recipient.w),
                        height: pctY(POSITIONS.recipient.h),
                    }}
                >
                    <div
                        className={`w-full h-full border ${isActive(4) ? 'border-white/60 shadow-glow-green' : 'border-dust-border'} bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center transition-all duration-300`}
                    >
                        <Wallet
                            className={`w-5 h-5 ${isActive(4) ? 'text-white' : 'text-dust-muted'} mb-1.5`}
                        />
                        <span className="text-[10px] tracking-wider">RECIPIENT</span>
                    </div>
                </div>
            </div>
            </div>
        </div>
    )
}
function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}
