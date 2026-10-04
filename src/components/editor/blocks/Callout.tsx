'use client'

import { defaultProps } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { useState } from 'react'
import { IconPicker } from '@/components/notebooks/IconPicker'

/** Notion's callout: an icon and a tinted box. Colour comes from the block menu (背景色). */
export const Callout = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      textColor: defaultProps.textColor,
      backgroundColor: defaultProps.backgroundColor,
      emoji: { default: '💡' },
    },
    content: 'inline',
  },
  {
    render: function CalloutView({ block, editor, contentRef }) {
      const [picking, setPicking] = useState(false)
      return (
        <div className="note-callout">
          <span className="relative shrink-0" contentEditable={false}>
            <button
              type="button"
              aria-label="更換圖示"
              disabled={!editor.isEditable}
              onClick={() => setPicking(true)}
              className="grid size-7 place-items-center rounded-md text-xl leading-none hover:bg-black/5"
            >
              {block.props.emoji || '💡'}
            </button>
            {picking && (
              <IconPicker
                value={block.props.emoji}
                onChange={(emoji) => editor.updateBlock(block, { props: { emoji: emoji || '💡' } })}
                onClose={() => setPicking(false)}
              />
            )}
          </span>
          <div ref={contentRef} className="note-callout-text" />
        </div>
      )
    },
  },
)
