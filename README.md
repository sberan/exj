<pre>
  EXJ(1)
  
  exj
  
  <b>NAME</b>
         exj - node.js standard input processor
  
  <b>SYNOPSIS</b>
         <em>exj</em> [<em>--json</em>] [<em>--line</em>] [<em>--exec</em>] [<em>-jlx</em>] [<em>-f</em> | <em>--file</em> 'fnfile' ] ['fn']
  <b>DESCRIPTION</b>
         <em>Exj</em> executes the given <em>fn</em> upon the standard input. <em>Fn</em> is expected to
         be a JavaScript function expression. The result of <em>fn</em> execution is 
         printed to standard output.
         
         If the result type of <em>fn</em> is a <b>string</b>, the result is printed directly
         to standard output.
        
         Any other result type is converted to JSON using <em>JSON.stringify()</em> and
         printed to standard output.
  
         If the result of <em>fn</em> is a <b>Promise</b>, the promise will be resolved and the
         result printed according to the above rules.
  
  <b>OPTIONS</b>
         <b>-j</b>, <b>--json</b>
                Treat the input text as JSON. Input text will be parsed to
                JavaScript objects using <em>JSON.parse()</em> before being passed to <em>fn</em>.
  
         <b>-l</b>, <b>--line</b>
                Process each line of input separately. For each line of standard
                input, <em>fn</em> will be invoked for each line encountered, and the
                result will be written to standard output.

         <b>-x</b>, <b>--exec</b>
                Execute each output entry as a child process. The standard output
                of the finished process will be written to standard out.

                NOTE: Output entry MUST be an array of the format ['executable', 'arg1', 'arg2', ...]

         <b>-f</b>, <b>--file</b> <em>'fnfile'</em>
                Read <em>fn</em> from a file, whose path is located at <em>'fnfile'</em>.

         <b>-g</b>, <b>--group-lines</b> <em>'num'</em>
                When processing lines, group batches of <em>num</em> lines together as an array
  
  
  <b>EXAMPLES</b>
  
         ls | exj -l 'x => x.toUpperCase()'
                Print the contents of the current directory in uppercase
  
         curl https://jsonplaceholder.typicode.com/photos \ | exj -j 'res => res.map((image) => `${image.title} - ${image.thumbnailUrl}`).join('\n')'
                Fetch and process a JSON payload of album artwork
  
         ls *.js | exj -lx 'x => ["mv", "x", x.replace(/\.js$/, ".ts")]'
                convert javascript files to typescript
  
  <b>SEE ALSO</b>
         <b>awk</b>(1), <b>jq</b>(1), <b>xargs</b>(1)
  
</pre>