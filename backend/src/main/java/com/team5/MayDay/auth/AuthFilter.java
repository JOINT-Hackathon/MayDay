package com.team5.MayDay.auth;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.net.URI;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
@Component
public class AuthFilter extends OncePerRequestFilter {
    public static final String COOKIE="mayday_session";
    private final AuthService auth;
    public AuthFilter(AuthService auth) { this.auth=auth; }
    public static String token(HttpServletRequest request) {
        if(request.getCookies()!=null) for(var cookie:request.getCookies()) if(COOKIE.equals(cookie.getName())) return cookie.getValue();
        return null;
    }
    private void reject(HttpServletResponse response,int status,String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json;charset=UTF-8"); response.getWriter().write("{\"error\":\""+message+"\"}");
    }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        if (!request.getRequestURI().startsWith("/api/")) { chain.doFilter(request,response); return; }
        response.setHeader("Cache-Control","no-store");
        if (!request.getMethod().equals("GET")) {
            String origin=request.getHeader("Origin");
            try { if (origin!=null && !URI.create(origin).getAuthority().equals(request.getHeader("Host"))) { reject(response,403,"허용되지 않은 요청입니다."); return; } }
            catch (RuntimeException error) { reject(response,403,"허용되지 않은 요청입니다."); return; }
            if(request.getContentType()==null || !request.getContentType().toLowerCase().startsWith("application/json")) { reject(response,415,"JSON 요청이 필요합니다."); return; }
        }
        Long id=auth.authenticate(token(request));
        if(id!=null) request.setAttribute("accountId",id);
        boolean publicRoute=request.getRequestURI().equals("/api/auth/login") || request.getRequestURI().equals("/api/auth/register");
        if(id==null && !publicRoute) { reject(response,401,"로그인이 필요합니다."); return; }
        chain.doFilter(request,response);
    }
}
