# LivingPicture Video Viewing System

A secure, premium video viewing platform for customers to access their LivingPicture videos.

## 🎯 Features

- **Secure Access**: JWT token authentication with 7-day expiration
- **Premium Design**: Luxury, minimalist interface with responsive layout
- **Video Player**: HTML5 video with custom controls and fullscreen support
- **Download Functionality**: Force MP4 download (not streaming)
- **Share Capability**: Web Share API on mobile, clipboard fallback on desktop
- **Multiple States**: Loading, not ready, invalid link, and ready states
- **Cloudinary Integration**: Secure signed URLs for video streaming and download

## 📁 Files Created

### Frontend
- `view.html` - Main video viewing page
- `css/view.css` - Premium styling with luxury design
- `js/view.js` - Video player and state management logic

### Backend (Netlify Functions)
- `get-order-view` - Main video access endpoint with JWT validation
- `generate-video-link` - Generate secure video links for customers
- `video-ready` - Mark videos as ready and send notifications
- `test-video-link` - Testing utility for video link generation

## 🔧 How It Works

### 1. Video Access Flow
1. Customer receives link: `view.html?orderId=12345&t=jwt_token`
2. Page validates JWT token and fetches order data
3. Based on order status, shows appropriate state:
   - Loading → Not Ready → Ready (with video player)

### 2. Security Features
- **JWT Tokens**: 7-day expiration, order-specific validation
- **Signed URLs**: Cloudinary signed URLs prevent hotlinking
- **Access Control**: Email verification and order ownership
- **No Direct URLs**: Raw Cloudinary URLs never exposed in HTML

### 3. Video States
- **Loading**: Shows spinner while fetching data
- **Not Ready**: "Your video is still being prepared" message
- **Invalid**: "Link expired or invalid" error state
- **Ready**: Full video player with download and share buttons

## 🚀 Deployment Requirements

### Environment Variables
```bash
# Airtable
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_ORDERS_TABLE=Orders

# Cloudinary
CLOUDINARY_CLOUD_NAME=dojuekij4
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# JWT Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Airtable Orders Table Fields
Ensure your Orders table has these fields:
- `orderId` (Single line text)
- `customerEmail` (Email)
- `customerName` (Single line text)
- `fulfillmentStatus` (Single select: NEW, PROCESSING, READY)
- `videoUrl` (URL)
- `message` (Single line text, optional)
- `videoReadyAt` (Date, optional)

## 📱 Usage Examples

### Generate Test Video Link
```bash
curl "https://your-site.netlify.app/.netlify/functions/test-video-link?orderId=12345&customerEmail=customer@example.com"
```

### Mark Video as Ready
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/video-ready \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "12345",
    "videoUrl": "https://cloudinary.com/...",
    "message": "Your LivingPicture is ready!"
  }'
```

### Access Video Page
```
https://www.livingpicture.net/view.html?orderId=12345&t=jwt_token_here
```

## 🎨 Design Features

### Visual Design
- **Color Scheme**: Soft beige background (#f5f2ed) with luxury brown accents
- **Typography**: Playfair Display for headings, Inter for body text
- **Layout**: Centered card design with rounded corners
- **Responsive**: Mobile-first approach with breakpoints at 768px and 480px

### User Experience
- **Smooth Animations**: Fade-in effects and micro-interactions
- **Loading States**: Clear feedback during data fetching
- **Error Handling**: Graceful fallbacks for all error scenarios
- **Accessibility**: High contrast support and reduced motion preferences

## 🔒 Security Considerations

### Token Security
- JWT tokens expire after 7 days
- Tokens are order-specific and email-verified
- Secret key should be changed in production
- Tokens validate order ownership

### URL Security
- Cloudinary URLs are signed and expire
- No raw URLs exposed in frontend code
- Access tokens validated server-side
- CORS headers properly configured

## 🛠 Testing

### Manual Testing
1. Use `test-video-link` function to generate test URLs
2. Test all states: loading, not ready, invalid, ready
3. Verify download functionality works correctly
4. Test share functionality on mobile and desktop
5. Check responsive design on various screen sizes

### Automated Testing
- JWT token validation
- Cloudinary URL signing
- Order status transitions
- Error handling scenarios

## 📧 Email Integration (Future)

The system is designed to easily integrate with email services:
- `video-ready` function generates customer links
- Email templates can use the generated videoUrl
- Customer email and name available from order data

## 🔄 Workflow Integration

### Current Workflow
1. Payment completes → Order created (status: NEW)
2. Video processed → Call `video-ready` endpoint
3. Customer receives link → Access via `view.html`

### Admin Workflow
- Mark orders as READY manually in Airtable
- Upload video to Cloudinary
- Call `video-ready` to notify customers

## 🐛 Troubleshooting

### Common Issues
- **"Invalid token"**: Check JWT secret and token expiration
- **"Video not available"**: Verify videoUrl field in Airtable
- **"Order not found"**: Check orderId and Airtable connection
- **CORS errors**: Verify function headers and deployment

### Debug Information
- All functions log detailed information to Netlify console
- Check browser console for frontend errors
- Verify environment variables are set correctly
- Test with `test-video-link` function first

## 📈 Performance

- **Lazy Loading**: Video metadata loads on demand
- **Signed URLs**: Cloudinary handles CDN and optimization
- **Minimal Assets**: Single CSS and JS file, optimized images
- **Fast Loading**: Loading states show immediately
- **Responsive Images**: Proper sizing for all devices

---

This system provides a secure, premium video viewing experience that matches the luxury positioning of LivingPicture products.
