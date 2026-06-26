import { describe, expect, it } from 'vitest';

import { urlDestinoSchema } from '../src/shared/url/url-destino.js';

describe('validação de URL de destino', () => {
  it('aceita http e https com host válido', () => {
    expect(urlDestinoSchema.safeParse('https://exemplo.com/caminho').success).toBe(true);
    expect(urlDestinoSchema.safeParse('http://sub.exemplo.com.br').success).toBe(true);
  });

  it('bloqueia esquemas perigosos', () => {
    expect(urlDestinoSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(urlDestinoSchema.safeParse('data:text/html,<script>').success).toBe(false);
    expect(urlDestinoSchema.safeParse('file:///etc/passwd').success).toBe(false);
  });

  it('recusa host sem ponto e texto que não é URL', () => {
    expect(urlDestinoSchema.safeParse('http://localhost').success).toBe(false);
    expect(urlDestinoSchema.safeParse('isso não é url').success).toBe(false);
  });
});
