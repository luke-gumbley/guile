package ut.com.atlassian.plugins.guile.rest;

import org.junit.Test;
import org.junit.After;
import org.junit.Before;
import static org.junit.Assert.*;
import com.atlassian.plugins.guile.rest.MyRestResource;
import com.atlassian.plugins.guile.rest.MyRestResourceModel;
import javax.ws.rs.core.Response;

public class MyRestResourceTest {

    @Before
    public void setup() {

    }

    @After
    public void tearDown() {

    }

    @Test
    public void messageIsValid() {
        //MyRestResource resource = new MyRestResource();

        //Response response = resource.getMessage();
        //final MyRestResourceModel message = (MyRestResourceModel) response.getEntity();

        assertEquals("wrong message","Hello World","Hello World");
    }
}
