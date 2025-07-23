# Course Discussions with Rich Text Support

This implementation adds comprehensive rich text editing capabilities to course discussions,
allowing users to create engaging posts and replies with formatted content, images, videos, and
more.

## Features

### Rich Text Editing

- **Text Formatting**: Bold, italic, code formatting
- **Lists**: Bulleted and numbered lists
- **Headings**: H2 and H3 headings for structure
- **Blockquotes**: For highlighting important information
- **Links**: Add clickable links to external resources
- **Images**: Embed images via URL or file upload
- **Videos**: Embed YouTube videos or video links
- **Code Blocks**: Syntax-highlighted code snippets
- **File Upload**: Upload and embed various file types

### Content Rendering

- **Safe HTML Rendering**: Uses DOMPurify to sanitize content and prevent XSS attacks
- **Responsive Design**: Content adapts to different screen sizes
- **Accessible**: Proper semantic markup and styling

### User Experience

- **WYSIWYG Editor**: What you see is what you get editing experience
- **Toolbar**: Intuitive toolbar with formatting options
- **Undo/Redo**: Full undo and redo support
- **Real-time Preview**: See formatting changes immediately
- **Mobile Friendly**: Works well on mobile devices

## Components

### `RichTextEditor`

A comprehensive rich text editor built with Tiptap that supports:

- Text formatting (bold, italic, code)
- Lists and blockquotes
- Headings
- Links, images, and videos
- File uploads
- Undo/redo functionality

**Props:**

- `content`: Current HTML content
- `onChange`: Callback when content changes
- `placeholder`: Placeholder text
- `className`: Additional CSS classes
- `minHeight`: Minimum height of the editor

### `RichContentRenderer`

A component for safely rendering rich HTML content with:

- XSS protection via DOMPurify
- Responsive styling
- Proper typography
- Image and video handling

**Props:**

- `content`: HTML content to render
- `className`: Additional CSS classes

### Updated Discussion Components

All discussion components have been updated to support rich content:

- `DiscussionForm`: Uses rich text editor for creating posts
- `DiscussionPost`: Renders rich content and supports rich editing
- `DiscussionReply`: Supports rich content in replies
- `DiscussionList`: Handles rich content in all interactions

## Implementation Details

### Dependencies

- `@tiptap/react`: Core Tiptap React integration
- `@tiptap/starter-kit`: Basic text editing functionality
- `@tiptap/extension-link`: Link support
- `@tiptap/extension-image`: Image embedding
- `@tiptap/extension-youtube`: YouTube video embedding
- `dompurify`: HTML sanitization for security

### Security

- All user-generated HTML content is sanitized using DOMPurify
- Only allowed HTML tags and attributes are permitted
- XSS protection is built-in

### Styling

- Uses Tailwind CSS for styling
- Prose typography classes for readable content
- Responsive design patterns
- Custom CSS for editor-specific styling

## Usage Example

```tsx
import RichTextEditor from './rich-text-editor';
import RichContentRenderer from './rich-content-renderer';

// For editing
<RichTextEditor
  content={content}
  onChange={setContent}
  placeholder="Write your message..."
  minHeight="150px"
/>

// For display
<RichContentRenderer
  content={htmlContent}
  className="my-custom-class"
/>
```

## Customization

The rich text editor can be customized by:

- Modifying the Tiptap extensions in `RichTextEditor`
- Adjusting the toolbar buttons and dialogs
- Customizing the styling in `globals.css`
- Adding new content types via Tiptap extensions

## Future Enhancements

Potential improvements could include:

- File upload to cloud storage
- Collaborative editing
- Mention system (@username)
- Emoji picker
- Markdown import/export
- Advanced table editing
- LaTeX math support
- Real-time collaborative features
