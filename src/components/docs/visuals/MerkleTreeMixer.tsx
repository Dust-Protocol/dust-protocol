"use client";
import React, {
    useCallback,
    useEffect,
    useState,
    useRef,
    Fragment,
} from 'react'
import { motion } from 'framer-motion'
// Tree layout: 4 levels, centered in a 720x300 viewBox
// Each node has an index within its level
// Level 0: 1 node (root)
// Level 1: 2 nodes
// Level 2: 4 nodes
// Level 3: 8 nodes (leaves)
const TREE_W = 640
const TREE_H = 260
const TREE_X0 = 40 // left offset
const TREE_Y0 = 20 // top offset
const NODE_SIZE = 22
const ROOT_SIZE = 28
const LEVEL_GAP = 70
function nodePos(level: number, index: number) {
    const count = Math.pow(2, level)
    const levelWidth = TREE_W
    const spacing = levelWidth / count
    const x = TREE_X0 + spacing * index + spacing / 2
    const y = TREE_Y0 + level * LEVEL_GAP
    const size = level === 0 ? ROOT_SIZE : NODE_SIZE
    return {
        x,
        y,
        size,
    }
}
// Pre-filled leaves: indices 0-4, target: 5, empty: 6-7
const FILLED_LEAVES = [0, 1, 2, 3, 4]
const TARGET_LEAF = 5
// Path from leaf 5 up to root: leaf5 → parent(level2, idx2) → grandparent(level1, idx1) → root
const DEPOSIT_PATH = [
    {
        level: 3,
        index: 5,
    },
    {
        level: 2,
        index: 2,
    },
    {
        level: 1,
        index: 1,
    },
    {
        level: 0,
        index: 0,
    },
]
// Merkle proof siblings (nodes adjacent to the path, used in withdraw)
const PROOF_SIBLINGS = [
    {
        level: 3,
        index: 4,
    },
    {
        level: 2,
        index: 3,
    },
    {
        level: 1,
        index: 0,
    }, // sibling of grandparent
]
export function MerkleTreeMixer() {
    const [phase, setPhase] = useState<'idle' | 'deposit' | 'withdraw'>('idle')
    const [depositStep, setDepositStep] = useState(-1) // -1=none, 0=appearing, 1=filled, 2-5=path highlight (bottom to top)
    const [withdrawStep, setWithdrawStep] = useState(-1) // -1=none, 0-2=sibling highlights, 3=verified
    const [setCount, setSetCount] = useState(1048576)
    const cancelled = useRef(false)
    const runLoop = useCallback(async () => {
        while (!cancelled.current) {
            // DEPOSIT PHASE
            setPhase('deposit')
            setDepositStep(0)
            await delay(800) // leaf appearing
            setDepositStep(1)
            await delay(400) // leaf filled
            setSetCount((c) => c + 1)
            setDepositStep(2)
            await delay(350) // highlight leaf
            setDepositStep(3)
            await delay(350) // highlight parent
            setDepositStep(4)
            await delay(350) // highlight grandparent
            setDepositStep(5)
            await delay(800) // highlight root
            if (cancelled.current) return
            // WITHDRAW PHASE
            setPhase('withdraw')
            setDepositStep(-1)
            setWithdrawStep(0)
            await delay(600)
            setWithdrawStep(1)
            await delay(600)
            setWithdrawStep(2)
            await delay(600)
            setWithdrawStep(3)
            await delay(1500)
            if (cancelled.current) return
            // RESET
            setPhase('idle')
            setWithdrawStep(-1)
            await delay(1200)
        }
    }, [])
    useEffect(() => {
        cancelled.current = false
        runLoop()
        return () => {
            cancelled.current = true
        }
    }, [runLoop])
    // Check if a node is highlighted
    function isDepositHighlighted(level: number, index: number) {
        if (phase !== 'deposit') return false
        // depositStep 2=leaf(path[0]), 3=parent(path[1]), 4=gp(path[2]), 5=root(path[3])
        const pathIdx = depositStep - 2
        if (pathIdx < 0) return false
        for (let i = 0; i <= pathIdx && i < DEPOSIT_PATH.length; i++) {
            if (DEPOSIT_PATH[i].level === level && DEPOSIT_PATH[i].index === index)
                return true
        }
        return false
    }
    function isWithdrawHighlighted(level: number, index: number) {
        if (phase !== 'withdraw') return false
        for (let i = 0; i <= withdrawStep && i < PROOF_SIBLINGS.length; i++) {
            if (
                PROOF_SIBLINGS[i].level === level &&
                PROOF_SIBLINGS[i].index === index
            )
                return true
        }
        return false
    }
    function isLeafFilled(index: number) {
        if (FILLED_LEAVES.includes(index)) return true
        if (index === TARGET_LEAF && phase === 'deposit' && depositStep >= 1)
            return true
        if (index === TARGET_LEAF && phase === 'withdraw') return true
        return false
    }
    return (
        <div className="w-full relative border border-dust-border bg-[rgba(255,255,255,0.01)] p-4 sm:p-8 flex flex-col font-mono">
            <div className="text-[10px] text-dust-muted uppercase tracking-[0.2em] mb-2">
                PRIVACY POOL / MERKLE TREE
            </div>

            <div
                className="relative w-full"
                style={{
                    aspectRatio: '720 / 300',
                }}
            >
                <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 720 300"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <filter id="treeGlow">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* CONNECTOR LINES between all parent-child pairs */}
                    {[0, 1, 2].map((level) => {
                        const parentCount = Math.pow(2, level)
                        return Array.from({
                            length: parentCount,
                        }).map((_, pi) => {
                            const parent = nodePos(level, pi)
                            const child0 = nodePos(level + 1, pi * 2)
                            const child1 = nodePos(level + 1, pi * 2 + 1)
                            const pSize = level === 0 ? ROOT_SIZE : NODE_SIZE
                            // Check if this line is on the deposit highlight path
                            const isOnPath = (cl: number, ci: number) => {
                                if (phase !== 'deposit') return false
                                return (
                                    isDepositHighlighted(level, pi) &&
                                    isDepositHighlighted(cl, ci)
                                )
                            }
                            return (
                                <Fragment key={`${level}-${pi}`}>
                                    <line
                                        x1={parent.x}
                                        y1={parent.y + pSize / 2 + 2}
                                        x2={child0.x}
                                        y2={child0.y - NODE_SIZE / 2 - 2}
                                        stroke={
                                            isOnPath(level + 1, pi * 2)
                                                ? '#00FF41'
                                                : 'rgba(255,255,255,0.08)'
                                        }
                                        strokeWidth={isOnPath(level + 1, pi * 2) ? 1.5 : 0.5}
                                        className="transition-all duration-300"
                                    />
                                    <line
                                        x1={parent.x}
                                        y1={parent.y + pSize / 2 + 2}
                                        x2={child1.x}
                                        y2={child1.y - NODE_SIZE / 2 - 2}
                                        stroke={
                                            isOnPath(level + 1, pi * 2 + 1)
                                                ? '#00FF41'
                                                : 'rgba(255,255,255,0.08)'
                                        }
                                        strokeWidth={isOnPath(level + 1, pi * 2 + 1) ? 1.5 : 0.5}
                                        className="transition-all duration-300"
                                    />
                                </Fragment>
                            )
                        })
                    })}

                    {/* TREE NODES */}
                    {[0, 1, 2, 3].map((level) => {
                        const count = Math.pow(2, level)
                        return Array.from({
                            length: count,
                        }).map((_, i) => {
                            const pos = nodePos(level, i)
                            const size = level === 0 ? ROOT_SIZE : NODE_SIZE
                            const half = size / 2
                            const depHL = isDepositHighlighted(level, i)
                            const witHL = isWithdrawHighlighted(level, i)
                            const filled = level === 3 && isLeafFilled(i)
                            let stroke = 'rgba(255,255,255,0.08)'
                            let fill = 'rgba(255,255,255,0.02)'
                            let glowFilter = ''
                            if (level === 0) {
                                stroke = '#00FF41'
                                if (depHL) {
                                    fill = 'rgba(0,255,65,0.15)'
                                    glowFilter = 'url(#treeGlow)'
                                }
                            } else if (depHL) {
                                stroke = '#00FF41'
                                fill = 'rgba(0,255,65,0.1)'
                                glowFilter = 'url(#treeGlow)'
                            } else if (witHL) {
                                stroke = '#FFB000'
                                fill = 'rgba(255,176,0,0.1)'
                                glowFilter = 'url(#treeGlow)'
                            } else if (filled) {
                                stroke = 'rgba(0,255,65,0.4)'
                                fill = 'rgba(0,255,65,0.08)'
                            }
                            return (
                                <Fragment key={`node-${level}-${i}`}>
                                    <rect
                                        x={pos.x - half}
                                        y={pos.y - half}
                                        width={size}
                                        height={size}
                                        fill={fill}
                                        stroke={stroke}
                                        strokeWidth="1"
                                        filter={glowFilter}
                                        className="transition-all duration-300"
                                    />
                                    {/* Root label */}
                                    {level === 0 && (
                                        <text
                                            x={pos.x}
                                            y={pos.y - half - 6}
                                            fill="#00FF41"
                                            fontSize="9"
                                            textAnchor="middle"
                                            fontFamily="JetBrains Mono"
                                        >
                                            ROOT
                                        </text>
                                    )}
                                    {/* Leaf "dep" labels */}
                                    {level === 3 && filled && (
                                        <text
                                            x={pos.x}
                                            y={pos.y + half + 12}
                                            fill="rgba(255,255,255,0.3)"
                                            fontSize="7"
                                            textAnchor="middle"
                                            fontFamily="JetBrains Mono"
                                        >
                                            dep
                                        </text>
                                    )}
                                </Fragment>
                            )
                        })
                    })}

                    {/* DEPOSIT: Appearing node animation (replaced dropping dot) */}
                    {phase === 'deposit' &&
                        depositStep === 0 &&
                        (() => {
                            const target = nodePos(3, TARGET_LEAF)
                            return (
                                <motion.rect
                                    x={target.x - NODE_SIZE / 2}
                                    y={target.y - NODE_SIZE / 2}
                                    width={NODE_SIZE}
                                    height={NODE_SIZE}
                                    fill="rgba(0,255,65,0.4)"
                                    filter="url(#treeGlow)"
                                    initial={{
                                        opacity: 0,
                                        scale: 0.5,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    transition={{
                                        duration: 0.6,
                                        ease: 'easeOut',
                                    }}
                                />
                            )
                        })()}

                    {/* WITHDRAW: "proof verified" label + recipient */}
                    {phase === 'withdraw' &&
                        withdrawStep >= 3 &&
                        (() => {
                            const root = nodePos(0, 0)
                            return (
                                <motion.g
                                    initial={{
                                        opacity: 0,
                                    }}
                                    animate={{
                                        opacity: 1,
                                    }}
                                >
                                    <line
                                        x1={root.x + ROOT_SIZE / 2 + 4}
                                        y1={root.y}
                                        x2={root.x + 80}
                                        y2={root.y}
                                        stroke="#00FF41"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={root.x + 90}
                                        y={root.y - 6}
                                        fill="#00FF41"
                                        fontSize="9"
                                        fontFamily="JetBrains Mono"
                                    >
                                        proof verified ✓
                                    </text>
                                    <rect
                                        x={root.x + 90}
                                        y={root.y + 2}
                                        width={80}
                                        height={24}
                                        fill="rgba(255,255,255,0.03)"
                                        stroke="rgba(255,255,255,0.08)"
                                    />
                                    <text
                                        x={root.x + 130}
                                        y={root.y + 18}
                                        fill="rgba(255,255,255,0.7)"
                                        fontSize="8"
                                        textAnchor="middle"
                                        fontFamily="JetBrains Mono"
                                    >
                                        RECIPIENT
                                    </text>
                                </motion.g>
                            )
                        })()}
                </svg>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end border-t border-dust-border pt-3">
                <div>
                    <div className="text-[9px] text-dust-muted uppercase tracking-wider">
                        ANONYMITY SET
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[16px] font-bold text-white">
                            {setCount.toLocaleString()}
                        </span>
                        {phase === 'deposit' && depositStep === 1 && (
                            <motion.span
                                initial={{
                                    opacity: 0,
                                    y: 4,
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                }}
                                className="text-[10px] text-dust-green"
                            >
                                +1
                            </motion.span>
                        )}
                    </div>
                    <div className="text-[8px] text-dust-muted mt-0.5">
                        DEPTH 20 · 2²⁰ ≈ 1,048,576 LEAVES
                    </div>
                </div>
                <div className="flex gap-2">
                    <span className="px-1.5 py-0.5 border border-dust-border bg-[rgba(255,255,255,0.02)] text-[8px] text-dust-muted tracking-wider">
                        GROTH16
                    </span>
                    <span className="px-1.5 py-0.5 border border-dust-border bg-[rgba(255,255,255,0.02)] text-[8px] text-dust-muted tracking-wider">
                        BN254
                    </span>
                </div>
            </div>
        </div>
    )
}
function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}
