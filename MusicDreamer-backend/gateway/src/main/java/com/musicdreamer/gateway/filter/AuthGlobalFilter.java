package com.musicdreamer.gateway.filter;

import com.musicdreamer.common.api.Mess;
import com.musicdreamer.common.jwt.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * 统一鉴权过滤器（设计 4.2 节）：
 * 白名单放行 → 解析 JWT → 剥离伪造头并透传身份 → 管理员/上传者路由角色校验。
 */
@Slf4j
@Component
public class AuthGlobalFilter implements GlobalFilter, Ordered {

    private final AntPathMatcher matcher = new AntPathMatcher();

    /** 匿名可访问。 */
    private static final String[] WHITELIST = {
            "/api/v1/user/login", "/api/v1/user/register", "/api/v1/user/activate",
            "/api/v1/user/password/reset",
            "/api/v1/search/**", "/api/v1/song/play/**", "/api/v1/song/detail/**",
            "/api/v1/announcement/**", "/api/v1/song/chart/**",
            "/data/**",
    };

    /** 需要 role=2（管理员）。 */
    private static final String[] ADMIN_PATHS = {
            "/api/v1/user/list*", "/api/v1/user/status", "/api/v1/user/singer/audit",
            "/api/v1/song/audit", "/api/v1/song/takedown", "/api/v1/song/relist",
            "/api/v1/song/edit", "/api/v1/report/**",
            "/api/v1/media/tools/**", "/api/v1/media/models/*/download",
            "/api/v1/media/models/*/use", "/api/v1/media/models/*/delete",
            "/api/v1/media/loudness/batch", "/api/v1/setting/set/**",
            "/api/v1/admin/**",
    };

    /** 需要 role>=1（歌手或管理员）：上传与链接导入。 */
    private static final String[] UPLOADER_PATHS = {
            "/api/v1/song/upload", "/api/v1/song/submit", "/api/v1/media/download",
            "/api/v1/upload/**", "/api/v1/media/transcribe/**",
    };

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (matchAny(path, WHITELIST)) {
            return chain.filter(sanitize(exchange));
        }

        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, 2006, "Token已过期");
        }
        Claims claims = JwtUtil.parse(auth.substring(7));
        if (claims == null) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, 2006, "Token已过期");
        }

        Long userId = claims.get(JwtUtil.CLAIM_USER_ID, Number.class).longValue();
        Integer role = claims.get(JwtUtil.CLAIM_ROLE, Number.class).intValue();
        String username = String.valueOf(claims.get(JwtUtil.CLAIM_USERNAME));

        if (matchAny(path, ADMIN_PATHS) && role != 2) {
            return reject(exchange, HttpStatus.FORBIDDEN, 2007, "权限不足");
        }
        if (matchAny(path, UPLOADER_PATHS) && role < 1) {
            return reject(exchange, HttpStatus.FORBIDDEN, 2007, "权限不足");
        }

        ServerHttpRequest mutated = sanitize(exchange).getRequest().mutate()
                .header("X-User-Id", String.valueOf(userId))
                .header("X-User-Role", String.valueOf(role))
                .header("X-Username", username)
                .build();
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    /** 剥离外部伪造的身份头，防止绕过网关直透。 */
    private ServerWebExchange sanitize(ServerWebExchange exchange) {
        ServerHttpRequest mutated = exchange.getRequest().mutate()
                .headers(h -> {
                    h.remove("X-User-Id");
                    h.remove("X-User-Role");
                    h.remove("X-Username");
                })
                .build();
        return exchange.mutate().request(mutated).build();
    }

    private boolean matchAny(String path, String[] patterns) {
        for (String p : patterns) {
            if (matcher.match(p, path)) return true;
        }
        return false;
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, int code, String msg) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"code\":" + code + ",\"message\":\"" + msg
                + "\",\"timestamp\":" + System.currentTimeMillis()
                + ",\"path\":\"" + exchange.getRequest().getPath().value() + "\"}";
        DataBuffer buffer = response.bufferFactory()
                .wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
