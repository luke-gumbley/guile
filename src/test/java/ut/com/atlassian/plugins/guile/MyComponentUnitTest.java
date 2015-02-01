package ut.com.atlassian.plugins.guile;

import org.junit.Test;
import com.atlassian.plugins.guile.MyPluginComponent;
import com.atlassian.plugins.guile.MyPluginComponentImpl;

import static org.junit.Assert.assertEquals;

public class MyComponentUnitTest
{
    @Test
    public void testMyName()
    {
        MyPluginComponent component = new MyPluginComponentImpl(null);
        assertEquals("names do not match!", "myComponent",component.getName());
    }
}