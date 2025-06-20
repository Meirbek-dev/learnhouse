'use client';

import {
  FontBoldIcon,
  FontItalicIcon,
  StrikethroughIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DividerVerticalIcon,
  ListBulletIcon,
  TableIcon,
  RowsIcon,
  ColumnsIcon,
  SectionIcon,
  ContainerIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';
import {
  AlertCircle,
  AlertTriangle,
  BadgeHelp,
  Code,
  Cuboid,
  FileText,
  ImagePlus,
  Link2,
  MousePointerClick,
  Sigma,
  Tags,
  User,
  Video,
  List,
  ListOrdered,
  Globe,
} from 'lucide-react';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { SiYoutube } from '@icons-pack/react-simple-icons';
import LinkInputTooltip from './LinkInputTooltip';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import styled from 'styled-components';

export const ToolbarButtons = ({ editor, props }: any) => {
  const t = useTranslations('DashPage.Editor.Toolbar');
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const linkButtonRef = useRef<HTMLDivElement>(null);

  if (!editor) {
    return null;
  }

  const tableOptions = [
    {
      label: t('insertTable'),
      icon: <TableIcon />,
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      label: t('addRowBelow'),
      icon: <RowsIcon />,
      action: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: t('addColumnRight'),
      icon: <ColumnsIcon />,
      action: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: t('deleteRow'),
      icon: <SectionIcon />,
      action: () => editor.chain().focus().deleteRow().run(),
    },
    {
      label: t('deleteColumn'),
      icon: <ContainerIcon />,
      action: () => editor.chain().focus().deleteColumn().run(),
    },
  ];

  const listOptions = [
    {
      label: t('listOptions.bulletList'),
      icon: <List size={15} />,
      action: () => {
        if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().run();
        } else {
          editor.chain().focus().toggleOrderedList().run();
          editor.chain().focus().toggleBulletList().run();
        }
      },
    },
    {
      label: t('listOptions.orderedList'),
      icon: <ListOrdered size={15} />,
      action: () => {
        if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().run();
        } else {
          editor.chain().focus().toggleBulletList().run();
          editor.chain().focus().toggleOrderedList().run();
        }
      },
    },
  ];

  const handleLinkClick = () => {
    // Store the current selection
    const { from, to } = editor.state.selection;

    if (editor.isActive('link')) {
      const _currentLink = editor.getAttributes('link');
      setShowLinkInput(true);
    } else {
      setShowLinkInput(true);
    }

    // Restore the selection after a small delay to ensure the tooltip is rendered
    setTimeout(() => {
      editor.commands.setTextSelection({ from, to });
    }, 0);
  };

  const getCurrentLinkUrl = () => {
    if (editor.isActive('link')) {
      return editor.getAttributes('link').href;
    }
    return '';
  };

  const handleLinkSave = (url: string) => {
    editor
      .chain()
      .focus()
      .setLink({
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      })
      .run();
    setShowLinkInput(false);
  };

  const handleLinkCancel = () => {
    setShowLinkInput(false);
  };

  return (
    <ToolButtonsWrapper>
      <ToolBtn onClick={() => editor.chain().focus().undo().run()}>
        <ArrowLeftIcon />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()}>
        <ArrowRightIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
      >
        <FontBoldIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
      >
        <FontItalicIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
      >
        <StrikethroughIcon />
      </ToolBtn>
      <ListMenuWrapper>
        <ToolBtn
          onClick={() => setShowListMenu(!showListMenu)}
          className={showListMenu || editor.isActive('bulletList') || editor.isActive('orderedList') ? 'is-active' : ''}
        >
          <ListBulletIcon />
          <ChevronDownIcon />
        </ToolBtn>
        {showListMenu && (
          <ListDropdown>
            {listOptions.map((option, index) => (
              <ListMenuItem
                key={index}
                onClick={() => {
                  option.action();
                  setShowListMenu(false);
                }}
                className={
                  editor.isActive(option.label === 'Bullet List' ? 'bulletList' : 'orderedList') ? 'is-active' : ''
                }
              >
                <span className="icon">{option.icon}</span>
                <span className="label">{option.label}</span>
              </ListMenuItem>
            ))}
          </ListDropdown>
        )}
      </ListMenuWrapper>
      <ToolSelect
        value={
          editor.isActive('heading', { level: 1 })
            ? '1'
            : editor.isActive('heading', { level: 2 })
              ? '2'
              : editor.isActive('heading', { level: 3 })
                ? '3'
                : editor.isActive('heading', { level: 4 })
                  ? '4'
                  : editor.isActive('heading', { level: 5 })
                    ? '5'
                    : editor.isActive('heading', { level: 6 })
                      ? '6'
                      : '0'
        }
        onChange={(e) => {
          const value = e.target.value;
          if (value === '0') {
            editor.chain().focus().setParagraph().run();
          } else {
            editor
              .chain()
              .focus()
              .toggleHeading({ level: Number.parseInt(value) })
              .run();
          }
        }}
        aria-label={t('heading')}
      >
        <option value="0">{t('paragraph')}</option>
        <option value="1">{t('headingLevel', { level: 1 })}</option>
        <option value="2">{t('headingLevel', { level: 2 })}</option>
        <option value="3">{t('headingLevel', { level: 3 })}</option>
        <option value="4">{t('headingLevel', { level: 4 })}</option>
        <option value="5">{t('headingLevel', { level: 5 })}</option>
        <option value="6">{t('headingLevel', { level: 6 })}</option>
      </ToolSelect>
      <TableMenuWrapper>
        <ToolTip content={t('table')}>
          <ToolBtn
            onClick={() => setShowTableMenu(!showTableMenu)}
            className={showTableMenu ? 'is-active' : ''}
          >
            <TableIcon width={18} />
            <ChevronDownIcon />
          </ToolBtn>
        </ToolTip>
        {showTableMenu && (
          <TableDropdown>
            {tableOptions.map((option, index) => (
              <TableMenuItem
                key={index}
                onClick={() => {
                  option.action();
                  setShowTableMenu(false);
                }}
              >
                <span className="icon">{option.icon}</span>
                <span className="label">{option.label}</span>
              </TableMenuItem>
            ))}
          </TableDropdown>
        )}
      </TableMenuWrapper>
      <DividerVerticalIcon style={{ marginTop: 'auto', marginBottom: 'auto', color: 'grey' }} />
      <ToolTip content={t('infoCallout')}>
        <ToolBtn onClick={() => editor.chain().focus().toggleNode('calloutInfo').run()}>
          <AlertCircle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('warningCallout')}>
        <ToolBtn onClick={() => editor.chain().focus().toggleNode('calloutWarning').run()}>
          <AlertTriangle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Link'}>
        <div style={{ position: 'relative' }}>
          <ToolBtn
            ref={linkButtonRef}
            onClick={handleLinkClick}
            className={editor.isActive('link') ? 'is-active' : ''}
          >
            <Link2 size={15} />
          </ToolBtn>
          {showLinkInput && (
            <LinkInputTooltip
              onSave={handleLinkSave}
              onCancel={handleLinkCancel}
              currentUrl={getCurrentLinkUrl()}
            />
          )}
        </div>
      </ToolTip>
      <ToolTip content={t('image')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockImage',
              })
              .run()
          }
        >
          <ImagePlus size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('video')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockVideo',
              })
              .run()
          }
        >
          <Video size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('youtubeVideo')}>
        <ToolBtn onClick={() => editor.chain().focus().insertContent({ type: 'blockEmbed' }).run()}>
          <SiYoutube size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('mathEquation')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockMathEquation',
              })
              .run()
          }
        >
          <Sigma size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('pdfDocument')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockPDF',
              })
              .run()
          }
        >
          <FileText size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('interactiveQuiz')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockQuiz',
              })
              .run()
          }
        >
          <BadgeHelp size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('codeBlock')}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
        >
          <Code size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('externalObject')}>
        <ToolBtn onClick={() => editor.chain().focus().insertContent({ type: 'blockEmbed' }).run()}>
          <Cuboid size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('badges')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'badge',
                content: [
                  {
                    type: 'text',
                    text: 'This is a Badge',
                  },
                ],
              })
              .run()
          }
        >
          <Tags size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('button')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'button',
                content: [
                  {
                    type: 'text',
                    text: t('clickMe'),
                  },
                ],
              })
              .run()
          }
        >
          <MousePointerClick size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('user')}>
        <ToolBtn onClick={() => editor.chain().focus().insertContent({ type: 'blockUser' }).run()}>
          <User size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={t('webPreview')}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockWebPreview',
              })
              .run()
          }
        >
          <Globe size={15} />
        </ToolBtn>
      </ToolTip>
    </ToolButtonsWrapper>
  );
};

const ToolButtonsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: left;
  justify-content: left;
`;

const ToolBtn = styled.div`
  display: flex;
  background: rgba(217, 217, 217, 0.24);
  border-radius: 6px;
  min-width: 25px;
  height: 25px;
  padding: 5px;
  margin-right: 5px;
  transition: all 0.2s ease-in-out;

  svg {
    padding: 1px;
  }

  &.is-active {
    background: rgba(176, 176, 176, 0.5);

    &:hover {
      background: rgba(139, 139, 139, 0.5);
      cursor: pointer;
    }
  }

  &:hover {
    background: rgba(217, 217, 217, 0.48);
    cursor: pointer;
  }
`;

const ToolSelect = styled.select`
  display: flex;
  background: rgba(217, 217, 217, 0.185);
  border-radius: 6px;
  width: 120px;
  border: none;
  height: 25px;
  padding: 2px 5px;
  font-size: 11px;
  font-family: 'DM Sans';
  margin-right: 5px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 5px center;
  background-size: 12px;
  padding-right: 20px;

  &:hover {
    background-color: rgba(217, 217, 217, 0.3);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(217, 217, 217, 0.5);
  }
`;

const TableMenuWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const TableDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid rgba(217, 217, 217, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 180px;
  margin-top: 4px;
`;

const TableMenuItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(217, 217, 217, 0.24);
  }

  .icon {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .label {
    font-size: 12px;
    font-family: 'DM Sans';
  }
`;

const ListMenuWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const ListDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid rgba(217, 217, 217, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 180px;
  margin-top: 4px;
`;

const ListMenuItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(217, 217, 217, 0.24);
  }

  &.is-active {
    background: rgba(176, 176, 176, 0.5);
  }

  .icon {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .label {
    font-size: 12px;
    font-family: 'DM Sans';
  }
`;
