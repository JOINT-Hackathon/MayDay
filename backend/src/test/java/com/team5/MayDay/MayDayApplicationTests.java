package com.team5.MayDay;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:context-test;MODE=MySQL")
class MayDayApplicationTests {

	@Test
	void contextLoads() {
	}

}
